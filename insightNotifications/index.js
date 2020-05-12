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
    let params = {TableName: process.env.TABLE_NAME};

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

function constructSentence(event) {
    if (event.field === "added" || event.field === "removed") {
        event.field = "lines " + event.field;
    }
    
    // Percent Changed Construction
    let value = event.value + " " + event.field;
    let percentChange = (event.value / event.units_from_mean).toFixed(0);
    
    // Days ago Construction
    let anomalyDate = new Date(event.date);
    let currentDate = Date.now();
    let difference = currentDate-anomalyDate;
    var days = Math.floor(difference / (1000 * 3600 * 24));
    let timePeriod = `${days} days ago`

    // Positive or Negative Change
    let changeWord = (value > 0) ? "decrease" : "increase";
    let rgWord = ``;
    if (event.rg_name) {
        rgWord = `(${event.rg_name})`;
    }

    let insightSentence = `There were ${value} on ${event.repo_git} ${rgWord} ${timePeriod}. `;
    let justificationSentence = `\nThat represents a ${percentChange * 100}% ${changeWord} from the mean!`;
    let fullSentence = insightSentence + justificationSentence;

    return fullSentence;
}

async function checkIfInterested(user, event) {
    // return true;

    let interestedRepos = user.interestedRepoGroups;
    let interestedRepoGroups = user.interestedGroups;
    let interestedInsightTypes = user.interestedInsightTypes;
    console.log(`interested Repos: ${interestedRepos}`);
    console.log(`interested rgs: ${interestedRepoGroups}`);
    console.log(`interested insight types: ${interestedInsightTypes}`);

    if (interestedRepos.includes(event.repo_git) || interestedRepoGroups.includes(event.rg_name)) {
        if (interestedInsightTypes.includes(event.metric)){
            console.log(`Interested Repos (${interestedRepos}) contains ${event.repo_git}\nOR\nInterested RepoGroups (${interestedRepoGroups}) contains ${event.rg_name}`);
            return true
        } else {
            return false
        }   
    } else {
        return false;
    }
}

async function updateCurrentMessages(user) {
    let params = {
        TableName: process.env.TABLE_NAME,
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
        TableName: process.env.TABLE_NAME,
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

async function clearUserSettings() {
    let users = await getAllUsers();

    for (user of users) {
        let params = {
            TableName: process.env.TABLE_NAME,
            Key: {
                "email": user.email
            },
            UpdateExpression: "set currentMessages = :messages, thread = :thread",
            ExpressionAttributeValues: {
                ":messages": 0,
                ":thread": "null"
            }
        };

        await docClient.update(params).promise();
    }
}

exports.handler = async (event) => {

    if (event.source == "aws.events") {
        await clearUserSettings();
        return;
    }

    console.log("Insight Event Received");
    console.log(JSON.stringify(event));
    let users = await getAllUsers();
    console.log(`users from getAllUsers: ${JSON.stringify(users)}`);

    for (user of users) {
        let interest = await checkIfInterested(user, event);

        if (interest) {
            if (user.currentMessages < user.maxMessages) {
                console.log(user); 
                let slackClient = new WebClient(user.botToken);
                await updateCurrentMessages(user);

                let channelResponse = await slackClient.conversations.open({
                    users: user.userID
                });


                let message = constructSentence(event);
                if (!user.thread || user.thread == "null") {
                    console.log("Creating Root Level Notification")
                    let messageResponse = await slackClient.chat.postMessage({
                        channel: channelResponse.channel.id,
                        text: "*New Augur Insights*"
                    });
                    console.log(JSON.stringify(messageResponse));
                    await updateThread(user, messageResponse.ts);

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
                        thread_ts: user.thread,
                        text: message
                    });
                }
            }
        }
    }
};

