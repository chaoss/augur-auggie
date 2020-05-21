const {
    WebClient
} = require('@slack/web-api');

const AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
const docClient = new AWS.DynamoDB.DocumentClient();

const ERROR_RESPONSE = `Looks like you currently don't have a host. This can be updated at auggie.augurlabs.io.`;

async function getUser(slackClient, event) {

    const lexID = event['userId'].split(':');
    const teamID = lexID[1];
    const userID = lexID[2];

    const userResponse = await slackClient.users.info({ "user": userID })

    const params = {
        TableName: process.env.USERS_TABLE_NAME,
        Key: {
            "email": `${userResponse.user.profile.email}:${teamID}`
        }
    };

    const response = await docClient.get(params).promise();
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
    const params = {
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
    console.log(`Received Request from GetHost Intent`);

    const slackClient = new WebClient(event['requestAttributes']['x-amz-lex:slack-bot-token']);
    const userResponse = await getUser(slackClient, event);    

    // If User exists in DynamoDB
    if (userResponse.Item) {
        const user = userResponse.Item;

        await updateBotToken(user, event['requestAttributes']['x-amz-lex:slack-bot-token']);

        if (!user.host || user.host == "null") {
            return buildResponse(ERROR_RESPONSE);
        } else {
            return buildResponse(`Your current host is ${user.host}. This can be updated at auggie.augurlabs.io`);
        }
    } else {
        return buildResponse(ERROR_RESPONSE);
    }
};