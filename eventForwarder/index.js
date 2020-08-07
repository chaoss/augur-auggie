const rp = require('request-promise');
const AWS = require('aws-sdk');

const lambda = new AWS.Lambda();

exports.handler = async (event) => {
    console.log("Received Event - Proceeding to Forward")
    console.log(event);

    const lexPostbackUrl = process.env.LEX_POSTBACK_URL;
    

    if (event.type == "url_verification") {
        // Slack Verification: Forward to Lex,
        // await response to return to Slack
        const options = {
            uri: lexPostbackUrl,
            method: 'POST',
            json: true,
            body: event
        };

        const response = await rp(options);

        return response;
    } else if (event.type == "block_actions" || event.type == "view_submission") {
        // Interaction Event
        var params = {
            FunctionName: 'auggie-reaction-handler',
            Payload: JSON.stringify(event)
        };

        let lambdaResponse = await lambda.invoke(params).promise();
        console.log(lambdaResponse);

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": ""
        }
        return {
            statusCode: 200,
            body: JSON.stringify(`Forwarded ${event} to Reaction Handler`),
        };
    } else if (event.event.type == "message") {
        // Slack Message: Forward to Lex for handling.
        const options = {
            uri: lexPostbackUrl,
            method: 'POST',
            json: true,
            body: event
        };

        await rp(options);

        return {
            statusCode: 200,
            body: JSON.stringify(`Forwarded ${event} to Lex`),
        };
    } else if (event.event.type == "reaction_added") {
        // Reaction Added: Forward to Reaction Handler

        var params = {
            FunctionName: 'auggie-reaction-handler',
            Payload: JSON.stringify(event)
        };

        let lambdaResponse = await lambda.invoke(params).promise();
        console.log(lambdaResponse);

        return {
            statusCode: 200,
            body: JSON.stringify(`Forwarded ${event} to Reaction Handler`),
        };
    } else {

        return {
            statusCode: 500,
            body: JSON.stringify(`Unable to forward ${event}`),
        };
    }

};
