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

    for (user of users) {
        if (user.teamID == teamID) {
            return user.botToken;
        }
    }

    return null;  
}

async function addReaction(teamID, ts, reaction) {
    let params = {
        TableName: process.env.MESSAGES_TABLE_NAME,
        Key: {
            "teamID": teamID,
            "ts": ts
        },
        UpdateExpression: 'SET #attrName = list_append(if_not_exists(#attrName, :empty_list), :my_value)',
        ExpressionAttributeNames: {
            "#attrName": "reactions"
        },
        ExpressionAttributeValues: { ":my_value": [reaction], ":empty_list": [] },
    }

    await docClient.update(params).promise();
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
    console.log(reactedMessage);

    if (!reactedMessage["bot_profile"]["app_id"] || reactedMessage["bot_profile"]["app_id"] != "ASQKB8JT0") {
        console.log("Reacted Message was not from Auggie.");
        return;
    }

    if (!reactedMessage.text.startsWith("There were ")) {
        console.log("Reacted Message was not relevant message from Auggie.");
        return;
    }

    console.log(`Received Reaction Notification: ${slackEvent.reaction} on message \n${JSON.stringify(slackEvent.item)}`);

    await addReaction(event.team_id, slackEvent.item.ts, slackEvent.reaction);


    const response = {
        statusCode: 200,
        body: `Received Reaction Notification: ${slackEvent.reaction} on message \n${slackEvent.item}`,
    };
    return response;
};
