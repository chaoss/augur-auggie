# auggie
Auggie enables slack notifications for anomolous repository changes, for repositories a user selects from their own instance of Augur (or one we create for you). You can even limit your notifications per day to the top "n" most anomalous stastical outliers. The training period and days for anomaly detection are all configurable in your Augur instance. Don't want to install Auggie yourself? No problem! We provide a public instance that will work against any Augur instance [or continuously running local instance] with a public IP or subdomain/doman on this site: http://auggie.augurlabs.io/#/configure. All you need is a Slack Account. 

NOTE: Slack restricts notification to private messages. 

Auggie implementation utilizing Amazon Lex to classify messages. 
  
Each directory represents an individual lambda function and is either an _intent_ as classified and delivered by Amazon Lex, or a function triggered by a source that is not Slack.

[Development Guide](DevelopmentGuide.md)
  
  
   
  


*Copyright Jonah Zukosky and the University of Missouri*
