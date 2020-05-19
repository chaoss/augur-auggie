const {
    WebClient
} = require('@slack/web-api');

var AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
let docClient = new AWS.DynamoDB.DocumentClient();

async function getUser(slackClient, event) {

    let lexID = event['userId'].split(':');
    let teamID = lexID[1];
    let userID = lexID[2];

    let userResponse = await slackClient.users.info({ "user": userID })

    var params = {
        TableName: process.env.TABLE_NAME,
        Key: {
            "email": `${userResponse.user.profile.email}:${teamID}`
        }
    };

    let response = await docClient.get(params).promise();

    if (response.Item) {
        return response.Item
    } else {
        return buildResponse(`Looks like you haven't setup your account yet. Head back to the configure site to make sure you're all setup.`);
        
    }
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
        TableName: process.env.TABLE_NAME,
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

    let user = await getUser(slackClient, event);    
    await updateBotToken(user, event['requestAttributes']['x-amz-lex:slack-bot-token']);

    
    if (user.dialogAction) {
        return user;
    } else {
        if (!user.host || user.host == "null") {
            return buildResponse(`Looks like you currently don't have a host. This can be updated at auggie.augurlabs.io.`)
        } else {
            return buildResponse(`Your current host is ${user.host}. This can be updated at auggie.augurlabs.io`)
        }
    }
};