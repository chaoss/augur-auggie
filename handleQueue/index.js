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

async function writeEvent(event) {

    const SECONDS_IN_AN_HOUR = 60 * 60;
    const secondsSinceEpoch = Math.round(Date.now() / 1000);
    const expirationTime = secondsSinceEpoch + 24 * SECONDS_IN_AN_HOUR;

    let params = {
        TableName: process.env.TABLE_NAME,
        Item: {
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

exports.handler = async (event) => {

    if (event.source == "aws.events") {
        await clearUserSettings();
        return;
    }

    console.log("Insight Event Received");
    console.log(JSON.stringify(event));

    await writeEvent(event);
};

