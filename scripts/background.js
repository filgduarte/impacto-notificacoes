async function handleSendNotification(notificationData, sendResponse)
{
    let storageData = await chrome.storage.sync.get('appData');
    const apiKey = storageData.appData.plugchatToken;
    const apiURLs =
    {
        text: 'https://www.plugchat.com.br/api/whatsapp/send-text',
        image: 'https://www.plugchat.com.br/api/whatsapp/send-image',
        sticker: 'https://www.plugchat.com.br/api/whatsapp/send-text/send-sticker',
    }

    fetch(apiURLs[notificationData.messageType],
    {
        "method": "POST",
        "headers":
        {
            "authorization": apiKey,
            "Content-type": "application/json; charset=UTF-8"
        },
        "body":
        JSON.stringify({
            phone: notificationData.phone,
            message: notificationData.messageContent,
        })
    })
    .then(response => response.text())
    .then(data => {
        let dataObj = JSON.parse(data);
        sendResponse(dataObj);
    })
    .catch(error => {
            sendResponse(error);
    });
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse)
    {
        if (request.contentScriptQuery == 'sendNotification')
        {
            handleSendNotification(request.notificationData, sendResponse);
        }

        return true;
    }
);