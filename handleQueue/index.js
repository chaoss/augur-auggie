const {
    WebClient
} = require('@slack/web-api');

const AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
const docClient = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();


async function getAllUsers() {
    let users = [];
    let params = { TableName: process.env.USERS_TABLE_NAME };

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

async function clearUserSettings() {
    const users = await getAllUsers();

    for (user of users) {
        let params = {
            TableName: process.env.USERS_TABLE_NAME,
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

async function writeEvent(event) {

    const SECONDS_IN_AN_HOUR = 60 * 60;
    const secondsSinceEpoch = Math.round(Date.now() / 1000);
    const expirationTime = secondsSinceEpoch + 24 * SECONDS_IN_AN_HOUR;

    if (!event.messages_insight) {
        event.messages_insight = false;
    }

    const params = {
        TableName: process.env.QUEUE_TABLE_NAME,
        Item: {
            "messages_insight": event.messages_insight,
            "repo_git": event.repo_git,
            "value": event.value,
            "date": event.date,
            "field": event.field,
            "metric": event.metric,
            "units_from_mean": event.units_from_mean,
            "detection_method": event.detection_method,
            ttl: expirationTime
        }
    }


    const result = await docClient.put(params).promise()
    console.log(result);
}

async function triggerPosts(event) {
    const params = {
        FunctionName: 'auggie-post-insights',
        Payload: JSON.stringify(event)
    };

    const lambdaResponse = await lambda.invoke(params).promise();
    console.log(lambdaResponse);
}

exports.handler = async (event) => {

    if (event.source == "aws.events") {
        console.log("Clearing User Settings");
        await clearUserSettings();
        console.log("Triggering New Notifications");
        await triggerPosts(event);
    } else {
        console.log("Insight Event Received");
        console.log(JSON.stringify(event));
        await writeEvent(event);
        return {statusCode: 200, body: "Insight Event successfully added to Queue"}
    }

    
};

