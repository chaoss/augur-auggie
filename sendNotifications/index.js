const {
    WebClient
} = require('@slack/web-api');

var AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
let docClient = new AWS.DynamoDB.DocumentClient();


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
        let response = await docClient.scan(params).promise();
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
    let value = insight.value + " " + insight.field;
    let percentChange = (insight.value / insight.units_from_mean).toFixed(0);
    
    // Days ago Construction
    let anomalyDate = new Date(insight.date);
    let currentDate = Date.now();
    let difference = currentDate-anomalyDate;
    var days = Math.floor(difference / (1000 * 3600 * 24));
    let timePeriod = `${days} days ago`

    // Positive or Negative Change
    let changeWord = (value > 0) ? "decrease" : "increase";
    let rgWord = ``;
    if (insight.rg_name) {
        rgWord = `(${insight.rg_name})`;
    }

    let insightSentence = `There were ${value} on ${insight.repo_git} ${rgWord} ${timePeriod}. `;
    let justificationSentence = `\nThat represents a ${percentChange * 100}% ${changeWord} from the mean!`;
    let fullSentence = insightSentence + justificationSentence;

    return fullSentence;
}

async function checkIfInterested(user, insights) {

    let interestedInsights = [];

    for (insight of insights) {
        let interestedRepos = user.interestedRepos;
        let interestedRepoGroups = user.interestedGroups;
        let interestedInsightTypes = user.interestedInsightTypes;
        
        if (interestedRepos.includes(`https://${insight.repo_git}`) /*|| interestedRepoGroups.includes(insight.rg_name)*/) {
            if (interestedInsightTypes && interestedInsightTypes.includes(insight.metric)) {
                console.log(`Interested Repos (${interestedRepos}) contains ${insight.repo_git}\nOR\nInterested RepoGroups (${interestedRepoGroups}) contains ${insight.rg_name}`);
                interestedInsights.push(insight);
            }
        }
    }

    return interestedInsights;
}

async function updateCurrentMessages(user) {
    let params = {
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

async function updateThread(user, thread) {
    let params = {
        TableName: process.env.USERS_TABLE_NAME,
        Key: {
            "email": user.email
        },
        UpdateExpression: "set thread = :val",
        ExpressionAttributeValues: {
            ":val": thread
        }
    }

    await docClient.update(params).promise();
}

async function emptyQueue() {

}



exports.handler = async (event) => {
    console.log(JSON.stringify(event));

    // if (event.source == "aws.events") {
    //     await clearUserSettings();
    //     return;
    // }

    let users = await getAllUsers();
    console.log(`users from getAllUsers: ${JSON.stringify(users)}`);
    let insights = await getInsights();
    console.log(`insights from queue table: ${JSON.stringify(insights)}`);



    for (user of users) {
        let interestedInsights = await checkIfInterested(user, insights);
        interestedInsights = interestedInsights.slice(0, user.maxMessages - user.currentMessages);

        let userThread;
        let first = true;
        for (insight of interestedInsights) {
            console.log(JSON.stringify(insight));
            let slackClient = new WebClient(user.botToken);
            await updateCurrentMessages(user);

            let channelResponse = await slackClient.conversations.open({
                users: user.userID
            });
            console.log(JSON.stringify(insight));
            let message = constructSentence(insight);

            if (first) {
                first = false;
                console.log("Creating Root Level Notification")

                let messageResponse = await slackClient.chat.postMessage({
                    channel: channelResponse.channel.id,
                    text: "*New Augur Insights*"
                });

                console.log(JSON.stringify(messageResponse));
                userThread = messageResponse.ts;

                console.log("Creating Thread Level Notification")
                await slackClient.chat.postMessage({
                    channel: channelResponse.channel.id,
                    thread_ts: messageResponse.ts,
                    text: message
                });
            } else {
                console.log("Creating Thread Level Notification")
                await slackClient.chat.postMessage({
                    channel: channelResponse.channel.id,
                    thread_ts: userThread,
                    text: message
                });
            }
        }
    }

    // WIPE QUEUE TABLE


};

