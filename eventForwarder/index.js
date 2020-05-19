var rp = require('request-promise');
var AWS = require('aws-sdk');

var lambda = new AWS.Lambda();

exports.handler = async (event) => {
    console.log(event);

    const lexPostbackUrl = process.env.LEX_POSTBACK_URL;

    

    if (event.type == "url_verification") {

        var options = {
            uri: lexPostbackUrl,
            method: 'POST',
            json: true,
            body: event
        };

        let response = await rp(options);
        console.log(response);

        return response;
    } else if (event.event.type == "message") {
        var options = {
            uri: lexPostbackUrl,
            method: 'POST',
            json: true,
            body: event
        };

        let response = await rp(options);
        console.log(response);
    } else if (event.event.type == "reaction_added") {
        console.log("Reaction Added");

        var params = {
            FunctionName: 'auggie-reaction-handler',
            Payload: JSON.stringify(event)
        };

        let lambdaResponse = await lambda.invoke(params).promise();
        console.log(lambdaResponse);
    }

};
