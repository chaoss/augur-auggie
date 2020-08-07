
const methods = {};

methods.complaintModal = {
    "type": "modal",
    "title": {
        "type": "plain_text",
        "text": "Auggie Complaint Form"
    },
    "submit": {
        "type": "plain_text",
        "text": "Submit",
        "emoji": true
    },
    "close": {
        "type": "plain_text",
        "text": "Cancel",
        "emoji": true
    },
    "blocks": [
        {
            "type": "section",
            "block_id": "section-identifier",
            "text": {
                "type": "mrkdwn",
                "text": "Seems like you may have encountered something confusing or annoying about Auggie. If so, please detail the issue below."
            }
        },
        {
            "type": "divider"
        },
        {
            "type": "input",
            "element": {
                "type": "plain_text_input",
                "multiline": true
            },
            "label": {
                "type": "plain_text",
                "text": "Box of Issues",
                "emoji": true
            }
        }
    ]
}

methods.issueConfirmation = {
    blocks: [{
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "Looks like you might have encountered something confusing that I said or did. Would you like to submit an issue form?"
        }
    },
    {
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Yes",
                    "emoji": true
                },
                "action_id": "OPEN_COMPLAINT",
                "value": "OPEN_COMPLAINT"
            },
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "No",
                    "emoji": true
                },
                "action_id": "DO_NOTHING",
                "value": "DO_NOTHING"
            }
        ]
    }
    ]
}

module.exports = methods;
