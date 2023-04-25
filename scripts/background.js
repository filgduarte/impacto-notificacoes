chrome.runtime.onMessage.addListener(
    async function(request, sender, sendResponse)
    {
        if (request.contentScriptQuery == 'sendText')
        {
            let storageData = await chrome.storage.sync.get('appData');
            const apiKey = storageData.appData.plugchatToken;

            fetch("https://www.plugchat.com.br/api/whatsapp/send-text",
            {
                "method": "POST",
                "headers":
                {
                    "authorization": apiKey,
                    "Content-type": "application/json; charset=UTF-8"
                },
                "body":
                JSON.stringify({
                    phone: "5521988189988",
                    message: "Teste",
                })
            })
            .then(
                response =>
                {
                    return response.text()
                        .then(text =>
                        {
                            sendResponse([
                            {
                                body: text,
                                status: response.status,
                                statusText: response.statusText,
                                request: JSON.stringify(request),
                            }, null]);
                        });
                },
                error =>
                {
                    sendResponse([null, error]);
                }
            );
        }

        return true;
    }
);