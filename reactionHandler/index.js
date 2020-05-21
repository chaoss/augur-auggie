const {
    WebClient
} = require('@slack/web-api');

const AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
const docClient = new AWS.DynamoDB.DocumentClient();

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
}

async function addReaction(teamID, ts, reaction) {
    const params = {
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

async function storeMessage(insight, teamID, ts, channel, reaction, message) {
    const params = {
        TableName: process.env.MESSAGES_TABLE_NAME,
        Key: {
            "teamID": teamID,
            "ts": ts
        },
        UpdateExpression: 'SET #attr1 = :val1, #attr2 = :val2, #attr3 = :val3, #attr4 = list_append(if_not_exists(#attr4, :empty_list), :val4) ',
        ExpressionAttributeNames: {
            "#attr1": "insight",
            "#attr2": "channel",
            "#attr3": "message",
            "#attr4": "reactions",
        },
        ExpressionAttributeValues: {
            ":val1": insight,
            ":val2": channel,
            ":val3": message,
            ":val4": [reaction],
            ":empty_list": [],
        }
    }

    const result = await docClient.update(params).promise()
}


exports.handler = async (event) => {
    console.log(`Received Reaction: ${event}`);
    const slackEvent = event.event;

    const token = await getToken(event["team_id"]);
    if (!token) {
        console.log("Slack Token does not exist");
        return { statusCode: 500, body: JSON.stringify("Slack Token does not exist in DynamoDB.") };
    }
    const slackClient = new WebClient(token);

    const slackResponse = await slackClient.conversations.replies({
        channel: slackEvent.item.channel,
        ts: slackEvent.item.ts
    });

    const reactedMessage = slackResponse.messages[0];

    if (!reactedMessage["bot_profile"]["app_id"] || reactedMessage["bot_profile"]["app_id"] != "ASQKB8JT0") {
        console.log("Reacted Message was not from Auggie.");
        return {statusCode: 406, body: JSON.stringify("Reacted Message was not from Auggie.")};
    }

    if (!reactedMessage.text.startsWith("There were ")) {
        console.log("Not Insight Message, creating new object.")
        await storeMessage({}, event["team_id"], slackEvent.item.ts, slackEvent.item.channel, slackEvent.reaction, reactedMessage.text );
        return { statusCode: 200, body: JSON.stringify(`Received Reaction Notification: ${slackEvent.reaction} on message \n${slackEvent.item}`) };
    }

    console.log(`Received Reaction Notification: ${slackEvent.reaction} on message \n${JSON.stringify(slackEvent.item)}`);
    await addReaction(event.team_id, slackEvent.item.ts, slackEvent.reaction);

    return { statusCode: 200, body: JSON.stringify(`Received Reaction Notification: ${slackEvent.reaction} on message \n${slackEvent.item}`) };
};
