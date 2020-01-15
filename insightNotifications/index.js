const {
    WebClient
} = require('@slack/web-api');

var AWS = require("aws-sdk");
AWS.config.update({
    region: "us-east-1",
    endpoint: (process.env.ENVIRONMENT === "DEV") ? "http://localhost:8000" : null
});
let docClient = new AWS.DynamoDB.DocumentClient();


async function getAllUsers() {
    let users = [];
    let params = {TableName: process.env.TABLE_NAME};

    while (True) {
        let response = await docClient.scan(params).promise();
        users += response.Items
        if (response.LastEvaluatedKey) {
            params.ExclusiveStartKey = response.LastEvaluatedKey
            continue;
        } else {
            break;
        }
    } 

    return users;
}

function constructSentence(event) {
    if (event.field === "added" || event.field === "removed") {
        event.field = "lines " + event.field;
    }

    let value = event.value + " " + event.field;
    let percentChange = (event.value / event.units_from_mean).toFixed(0);
    let timePeriod = "90 days"
    let changeWord = (value > 0) ? "decrease" : "increase";
    let rgWord = ``;
    if (event.rg_name) {
        rgWord = `(${event.rg_name}) `;
    }

    let insightSentence = `There were ${value} on ${event.repo_git} ${rgWord}over the last ${timePeriod}. `;

    let justificationSentence = `\nThat represents a ${percentChange * 100}% ${changeWord} from the mean!`;

    let fullSentence = insightSentence + justificationSentence;

    return fullSentence;
}

async function checkIfInterested(client, event) {
    return true;
    // check to see if users interested repos/groups includes relevant repo/repo group

    let interestedRepos = await dynamoHelper.getRepos(client);
    let interestedRepoGroups = await dynamoHelper.getRepoGroups(client);
    console.log(`interested Repos: ${interestedRepos}`);
    console.log(`interested rgs: ${interestedRepoGroups}`);
    if (interestedRepos.includes(event.repo_git) || interestedRepoGroups.includes(event.rg_name)) {
        console.log(`Interested Repos (${interestedRepos}) contains ${event.repo_git}\nOR\nInterested RepoGroups (${interestedRepoGroups}) contains ${event.rg_name}`);
        return true
    } else {
        return false;
    }
}

exports.handler = async (event) => {
    console.log("Insight Event Received");
    let users = await getAllUsers();

    for (user of users) {
        let interest = await checkIfInterested(event);

        if (interest) {
            let slackClient = new WebClient(user.botToken);

            let channelResponse = await slackClient.im.open({
                user: user.userID
            });

            let message = constructSentence(event);
            await slackClient.chat.postMessage({
                channel: channelResponse.channel.id,
                text: "*New Augur Insight* \n\n" + message
            });
        }
    }
};