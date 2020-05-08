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
To begin devlopment on Auggie, clone the repo onto 


## Desired Improvements
### Improved Integration Pipeline  
    Current development requires code to be pushed to AWS and GitHub separately. A Jenkins Job triggered off of a GitHub commit that uploads code to Lambda would be optimal.