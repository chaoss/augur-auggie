const {
    WebClient
} = require('@slack/web-api');

const AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
const docClient = new AWS.DynamoDB.DocumentClient();


async function getAllUsers() {
    let users = [];
    let params = {TableName: process.env.USERS_TABLE_NAME};

    while (true) {
        let response = await docClient.scan(params).promise();
        users = users.concat(response.Items);
        if (response.LastEvaluatedKey) {
            params.ExclusiveStartKey = response.LastEvaluatedKey
            continue;
        } else {
            break;
        }
    } 

    return users;
}

async function getInsights() {
    let insights = [];
    let params = { TableName: process.env.QUEUE_TABLE_NAME };

    while (true) {
        const response = await docClient.scan(params).promise();
        insights = insights.concat(response.Items);
        if (response.LastEvaluatedKey) {
            params.ExclusiveStartKey = response.LastEvaluatedKey
            continue;
        } else {
            break;
        }
    }

    return insights;
}

function constructSentence(insight) {
    if (insight.field === "added" || insight.field === "removed") {
        insight.field = "lines " + insight.field;
    }
    
    // Percent Changed Construction
    const value = insight.value + " " + insight.field;
    const percentChange = (insight.value / insight.units_from_mean).toFixed(0);
    
    // Days ago Construction
    const daysAgo = Date.now() - new Date(insight.date);
    const days = Math.floor(daysAgo / (1000 * 3600 * 24));
    const timePeriod = `${days} days ago`

    // Positive or Negative Change
    const changeWord = (value > 0) ? "decrease" : "increase";
    let rgWord = ``;
    if (insight.rg_name) {
        rgWord = `(${insight.rg_name})`;
    }

    const insightSentence = `There were ${value} on ${insight.repo_git} ${rgWord} ${timePeriod}. `;
    const justificationSentence = `\nThat represents a ${percentChange * 100}% ${changeWord} from the mean!`;
    const fullSentence = insightSentence + justificationSentence;

    return fullSentence;
}

async function checkIfInterested(user, insights) {

    let interestedInsights = [];

    for (insight of insights) {
        const interestedRepos = user.interestedRepos;
        const interestedRepoGroups = user.interestedGroups;
        const interestedInsightTypes = user.interestedInsightTypes;
        
        if ((interestedRepos && interestedRepos.includes(`${insight.repo_git.substr(8)}`)) 
        || (interestedRepoGroups && interestedRepoGroups.includes(insight.rg_name))) {
            if (interestedInsightTypes && interestedInsightTypes.includes(insight.metric)) {
                interestedInsights.push(insight);
            }
        }
    }

    return interestedInsights;
}

async function updateCurrentMessages(user) {
    const params = {
        TableName: process.env.USERS_TABLE_NAME,
        Key: {
            "email": user.email
        },
        UpdateExpression: "set currentMessages = :val",
        ExpressionAttributeValues: {
            ":val": user.currentMessages += 1
        }
    }

    await docClient.update(params).promise();
}

async function storeMessage(insight, teamID, ts, channel, message) {
    const params = {
        TableName: process.env.MESSAGES_TABLE_NAME,
        Item: {
            "ts": ts,
            "teamID": teamID,
            "insight": insight,
            "channel": channel,
            "reactions": [],
            "message": message,
            "isSlackTS": true
        }
    }

    const result = await docClient.put(params).promise()
    console.log(result);
}

exports.handler = async (event) => {
    console.log(`Sending Notifications from Queue`);

    const users = await getAllUsers();
    const insights = await getInsights();
    console.log(`insights from queue table: ${JSON.stringify(insights)}`);

    for (user of users) {
        let interestedInsights = await checkIfInterested(user, insights);
        interestedInsights.sort(function (a, b) {
            return a.units_from_mean - b.units_from_mean;
        });
        interestedInsights = interestedInsights.slice(0, user.maxMessages - user.currentMessages);

        let userThread;
        let first = true;
        const slackClient = new WebClient(user.botToken);

        for (insight of interestedInsights) {
            await updateCurrentMessages(user);

            const channelResponse = await slackClient.conversations.open({
                users: user.userID
            });

            const message = constructSentence(insight);

            if (first) {
                first = false;
                console.log("Creating Root Level Notification")

                const messageResponse = await slackClient.chat.postMessage({
                    channel: channelResponse.channel.id,
                    text: "*New Augur Insights*"
                });

                userThread = messageResponse.ts;

                console.log("Creating Thread Level Notification")
                const threadResponse = await slackClient.chat.postMessage({
                    channel: channelResponse.channel.id,
                    thread_ts: messageResponse.ts,
                    text: message
                });
                await storeMessage(insight, threadResponse.message.team, threadResponse.ts, channelResponse.channel.id, message);
            } else {
                console.log("Creating Thread Level Notification")
                const threadResponse = await slackClient.chat.postMessage({
                    channel: channelResponse.channel.id,
                    thread_ts: userThread,
                    text: message
                });
                await storeMessage(insight, threadResponse.message.team, threadResponse.ts, channelResponse.channel.id, message);
            }
        }
    }
};

