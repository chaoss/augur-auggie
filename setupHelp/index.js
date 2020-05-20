const {
    WebClient
} = require('@slack/web-api');

var AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
let docClient = new AWS.DynamoDB.DocumentClient();

const ERROR_RESPONSE = "Oops, looks like you haven't setup your account yet. Head on over to auggie.augurlabs.io to get started!";
const POSITIVE_RESPONSE = `Need to get setup? Head over to auggie.augurlabs.io to get started!`;

async function getUser(slackClient, event) {
    let lexID = event['userId'].split(':');
    let teamID = lexID[1];
    let userID = lexID[2];

    let userResponse = await slackClient.users.info({ "user": userID })

    var params = {
        TableName: process.env.USERS_TABLE_NAME,
        Key: {
            "email": `${userResponse.user.profile.email}:${teamID}`
        }
    };

    let response = await docClient.get(params).promise();

    return response;
}

function buildResponse(message) {
    return {
        "dialogAction": {
            "type": "Close",
            "fulfillmentState": "Fulfilled",
            "message": {
                "contentType": "PlainText",
                "content": message
            }
        }
    };
}

async function updateBotToken(user, token) {
    let params = {
        TableName: process.env.USERS_TABLE_NAME,
        Key: {
            "email": user.email
        },
        UpdateExpression: "set botToken = :val",
        ExpressionAttributeValues: {
            ":val": token
        }
    }

    await docClient.update(params).promise();
}

exports.handler = async (event) => {
    let slackClient = new WebClient(event['requestAttributes']['x-amz-lex:slack-bot-token']);

    const userResponse = await getUser(slackClient, event);  
    if (userResponse.Item) {
        const user = userResponse.Item
        await updateBotToken(user, event['requestAttributes']['x-amz-lex:slack-bot-token']);

        const host = user.host;

        if (!host || host == "null" ) {
            return buildResponse(POSITIVE_RESPONSE)
        }

        return buildResponse(POSITIVE_RESPONSE)
    } else {
        return buildResponse(ERROR_RESPONSE);
    }
};