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
        return buildResponse("Oops, looks like you haven't setup your account yet. Head on over to TEMP augur.osshealth.io/slack-setup TEMP to get started!")
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

exports.handler = async (event) => {
    let slackClient = new WebClient(event['requestAttributes']['x-amz-lex:slack-bot-token']);

    let user = await getUser(slackClient, event);

    if (user.dialogAction) {
        return user;
    } else {
        let host = user.host;
        let message = ``;

        if (!host) {
            return buildResponse(`Looks like you're not tracking any repo groups yet. You can add some at augur.osshealth.io/slack-setup`)
        }

        for (group of user.interestedGroups) {
            message += `${group}\n`
        }

        if (message === "") {
            return buildResponse(`Looks like you're not tracking any repo groups yet. You can add some at ${user.host}/slack-setup`)
        }

        return buildResponse(`Your current tracked repo groups are: \n${message} These can be updated at ${user.host}/slack-setup`)
    }
};