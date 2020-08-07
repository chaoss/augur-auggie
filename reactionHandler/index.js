const {
    WebClient
} = require('@slack/web-api');
const components = require('./components');

const AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
const docClient = new AWS.DynamoDB.DocumentClient();

const CONFUSION_REACTS = ["question","grey_question","interrobang"];

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

    await docClient.update(params).promise()
}

async function openComplaintForm(event) {
    const token = await getToken(event.team.id);
    const messageInfo = event.actions[0].value;

    if (!token) {
        console.log("Slack Token does not exist");
        return { statusCode: 500, body: JSON.stringify("Slack Token does not exist in DynamoDB.") };
    }
    const slackClient = new WebClient(token);

    if (event.actions[0].action_id == 'OPEN_COMPLAINT') {
        let modal = components.complaintModal;
        modal.private_metadata = messageInfo;
        await slackClient.views.open({
            trigger_id: event.trigger_id,
            view: modal
        });
    }

    await slackClient.chat.delete({
        channel: event.channel.id,
        ts: event.message.ts
    });
}

async function handleViewSubmission(event) {
    const token = await getToken(event.team.id);
    const messageInfo = event.view.private_metadata.split(':');

    if (!token) {
        console.log("Slack Token does not exist");
        return { statusCode: 500, body: JSON.stringify("Slack Token does not exist in DynamoDB.") };
    }
    const userSlackClient = new WebClient(token);
    const augurSlackClient = new WebClient(process.env.AUGUR_TOKEN);

    const channelResponse = await userSlackClient.conversations.open({
        users: event.user.id
    });

    await userSlackClient.chat.postMessage({
        channel: channelResponse.channel.id,
        text: "Thank you for submitting your issue. It has been submitted for consideration to the team :frog:"
    });

    const slackResponse = await userSlackClient.conversations.replies({
        channel: messageInfo[1],
        ts: messageInfo[0]
    });
    const reactedMessage = slackResponse.messages[0];

    const blockID = event.view.blocks[2].block_id;
    const inputValue = event.view.blocks[2].element.action_id;
    const submissionText = event.view.state.values[`${blockID}`][`${inputValue}`].value;

    await augurSlackClient.chat.postMessage({
        channel: process.env.CHANNEL,
        text: `Issue: *${submissionText}* on message "${reactedMessage.text}".\nMessage Info - Channel: ${messageInfo[1]}, ts: ${messageInfo[0]}\nSubmitted by user ${event.user.name} in the ${event.team.domain} workspace.`
    });
}

exports.handler = async (event) => {
    console.log(`Received Reaction: ${JSON.stringify(event)}`);

    if (event.type == "block_actions") {
        await openComplaintForm(event);
        return;
    } else if (event.type == "view_submission") {
        await handleViewSubmission(event);
        return {
            statusCode: 200
        };
    }
    
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

    if (CONFUSION_REACTS.includes(slackEvent.reaction)) {

        const channelResponse = await slackClient.conversations.open({
            users: slackEvent.user
        });

        let confirmationMessage = components.issueConfirmation;
        
        confirmationMessage.channel = channelResponse.channel.id;
        confirmationMessage.user = slackEvent.user;
        confirmationMessage.blocks[1].elements[0].value = `${slackEvent.item.ts}:${channelResponse.channel.id}`;
        await slackClient.chat.postMessage(confirmationMessage);
        return;
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
