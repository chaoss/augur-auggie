# How to Contribute to Auggie
All of Auggie's code is hosted serverlessly using AWS Lambda. Insight Notifications are received through API Gateway and Slack Event Notifications are received through Amazon Lex. 


## Prerequisites
### An Augur AWS Account
In order to update Lambda Code, modify the API, or update Lex Intents, you will need access to both the Augur AWS console and CLI. The console can be reached at https://augurlabs.signin.aws.amazon.com/console.
  
Logging in as a root user (Sean's account) will allow you to create new IAM users. Follow the instructions [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html#id_users_create_console) to do this. Make sure to add the user to the `Developers` group on the `Set Permissions` page to ensure they have the correct credentials.

### AWS CLI Installation and Configuration
Once a user has been created, they will need their `aws_access_key_id` and `aws_secret_access_key` to configure access from the AWS CLI.

Install the AWS CLI as shown:
```
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

Once installed, you will need to configure your credentials in an augur profile.
```
aws configure --profile augur
```
Follow the prompted steps, entering your Access ID and Secret Key. Set your default region to `us-east-1`.

## Getting Started
To begin development on Auggie, clone the repo onto your machine.
```
git clone https://github.com/chaoss/augur-auggie.git
```
The format of the project is relatively simple. Each directory (getGroups, getRepos, etc.) represents a single Lambda Function. Subsequently, each Lambda Function represents a single Lex Intent. 

Changes made in these functions generally encompass updating how Auggie responds to specific intents and how Auggie gets that information from DynamoDB.

In order to upload your changes and have them take effect on AWS, you will need to create short shell script for each directory (and optionally, one script in the root directory that combines all of the nested scripts). Below is an example of what this should look like.
#### Short Script
```
zip -r lambda.zip . && aws lambda update-function-code --function-name {LAMBDA_ARN} --zip-file fileb://lambda.zip --profile augur --region us-east-1
```
#### Root Level Script
```
cd getGroups && \
zip -r lambda.zip . && aws lambda update-function-code --function-name {LAMBDA_ARN} --zip-file fileb://lambda.zip --profile augur --region us-east-1 \
&& cd .. && \
cd getHost && \
zip -r lambda.zip . && aws lambda update-function-code --function-name {LAMBDA_ARN} --zip-file fileb://lambda.zip --profile augur --region us-east-1 \
&& cd .. && \
cd getRepos && \
zip -r lambda.zip . && aws lambda update-function-code --function-name {LAMBDA_ARN} --zip-file fileb://lambda.zip --profile augur --region us-east-1 \
&& cd .. && \
cd insightNotifications && \
zip -r lambda.zip . && aws lambda update-function-code --function-name {LAMBDA_ARN} --zip-file fileb://lambda.zip --profile augur --region us-east-1 \
&& cd .. && \
cd setupHelp && \
zip -r lambda.zip . && aws lambda update-function-code --function-name {LAMBDA_ARN} --zip-file fileb://lambda.zip --profile augur --region us-east-1 \
&& cd .. && \
cd startTracking && \
zip -r lambda.zip . && aws lambda update-function-code --function-name {LAMBDA_ARN} --zip-file fileb://lambda.zip --profile augur --region us-east-1
```

__ARNs (and subsequently, these scripts) should never be pushed to version control. If a new directory is added, ensure you update the .gitignore.__

## Amazon Lex
Amazon Lex handles two major parts of Auggie's flow. Intent analysis and Distribution. The most important piece here is intent analysis though. When users interact with Auggie, Lex sorts messages into categories, or intents, to aid us in responding to them. Currently, this categorizaiton is relatively simple, but can become very elaborate if expanded upon. 

Each intent is defined by the list of Sample Utterances included in its console page. These utterances are what Lex searches for in order to categorize a message. This is not a strict list, but is used by Lex to capture all similar messages. 

Once a message is categorized to an Intent, Lex will either respond directly (such as in the case of the `Greeting` intent) or trigger a lambda function (such as in the `GetRepos` intent).
## Slack Console
The slack console (api.slack.com/apps) allows you to configure Auggie's permissions, distribution, event subscriptions, and display information.

Each individual contributor will need to be added as a collaborator. They will also need to be a member of the Augur Workspace.


## Desired Improvements
### Improved Integration Pipeline  
    Current development requires code to be pushed to AWS and GitHub separately. A Jenkins Job triggered off of a GitHub commit that uploads code to Lambda would be optimal.
