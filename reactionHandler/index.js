const {
    WebClient
} = require('@slack/web-api');

var AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
let docClient = new AWS.DynamoDB.DocumentClient();

async function getToken(teamID) {

    let users = [];
    let params = { TableName: process.env.TABLE_NAME };

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

    for (user of users) {
        if (user.teamID == teamID) {
            return user.botToken;
        }
    }

    return null;  
}


exports.handler = async (event) => {
    console.log(event);
    const slackEvent = event.event;

    const token = await getToken(event["team_id"]);
    const slackClient = new WebClient(token);

    const slackResponse = await slackClient.conversations.replies({
        channel: slackEvent.item.channel,
        ts: slackEvent.item.ts
    });

    const reactedMessage = slackResponse.messages[0];

    if (!reactedMessage["bot_id"] || reactedMessage["bot_id"] != "BSNDG3W1E") {
        console.log("Reacted Message was not from Auggie.");
        return;
    }

    console.log(`Received Reaction Notification: ${slackEvent.reaction} on message \n${JSON.stringify(slackEvent.item)}`);




    const response = {
        statusCode: 200,
        body: `Received Reaction Notification: ${slackEvent.reaction} on message \n${slackEvent.item}`,
    };
    return response;
};
