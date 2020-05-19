const {
    WebClient
} = require('@slack/web-api');

var AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
let docClient = new AWS.DynamoDB.DocumentClient();


exports.handler = async (event) => {

    console.log(event);

    let slackEvent = event.event;
    console.log(`Received Reaction Notification: ${slackEvent.reaction} on message \n${JSON.stringify(slackEvent.item)}`);
    const response = {
        statusCode: 200,
        body: `Received Reaction Notification: ${slackEvent.reaction} on message \n${JSON.stringify(slackEvent.item)}`,
    };
    return response;
};
