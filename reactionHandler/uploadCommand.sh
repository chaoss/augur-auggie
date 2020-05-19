zip -r lambda.zip . && aws lambda update-function-code --function-name arn:aws:lambda:us-east-1:087468321421:function:auggie-reaction-handler --zip-file fileb://lambda.zip --profile augur --region us-east-1


