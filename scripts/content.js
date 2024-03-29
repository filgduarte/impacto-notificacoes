const baseURL = location.href.split("?")[0];
const urlParams = new URLSearchParams(window.location.search);
const currentPage = urlParams.get("imprimastore");

if (currentPage) {
        init();
}

async function init() {
    await chrome.storage.local.get({ siteSync: false }, function (data) {
        chrome.storage.local.set({ siteSync: data.siteSync });
    });
    let storageData = await getAppData();
    let appData = storageData.appData;
    console.log(storageData);

    if (storageData == false || appData == false) {
        const errorMessage =
            "Não foi possível recuperar os dados das notificações.";
        showAlert("Erro", errorMessage, "danger");

        throw errorMessage;
    }

    const statusSelects = document.querySelectorAll(
        "select.pedido-item-status-alterar"
    );
    if (statusSelects) {
        statusSelects.forEach((statusSelect) => {
            statusSelect.addEventListener("change", handleStatusChange);
        });
    }

    const paymentContainer = document
        .querySelector(".fa.fa-donate")
        ?.closest(".linha.mb-40");
    if (paymentContainer) {
        const addPaymentBtn = paymentContainer.querySelector(".btn");
        addPaymentBtn?.addEventListener("click", function () {
            sendNotification("billing_1", this);
        });
    }

    const discountContainer = document
        .querySelector(".fa.fa-tags")
        ?.closest(".linha.mb-40");
    if (discountContainer) {
        const addDiscountBtn = discountContainer.querySelector(".btn");
        addDiscountBtn?.addEventListener("click", function () {
            sendNotification("billing_2", this);
        });
    }
}

async function getAppData() {
    const siteSync = await chrome.storage.local.get({ siteSync: false });
    let storageData = await chrome.storage.local.get(null);

    if (siteSync == false) {
        return storageData;
    }

    let siteData = await getDataFromSite();

    if (Object.keys(siteData).length == 0) {
        console.log(
            "GRÁFICA IMPRIMA NOTIFICAÇÕES: Erro ao recuperar dados do site."
        );

        return storageData;
    }

    if (Object.keys(storageData).length == 0) {
        chrome.storage.local.set(siteData);
        storageData = await chrome.storage.local.get(null);

        return storageData;
    }

    let upToDateData = {
        appData: storageData.appData,
        status: siteData.status,
        billing: storageData.billing ?? siteData.billing,
    };

    for (key in storageData) {
        if (
            key == "appData" ||
            key == "status" ||
            key == "billing" ||
            key == "lastSentMessages" ||
            key == "lastChange"
        )
            continue;

        if (key.slice(0, 6) == "status") {
            let statusId = key.slice(7); // status_ -> 7 characters
            if (siteData.status.find((item) => item.id === statusId)) {
                upToDateData[key] = storageData[key];
            } else {
                chrome.storage.local.remove(key);
            }
        } else {
            let billingId = key.slice(8); // billing_ -> 8 characters

            if (!storageData.billing) continue;

            if (storageData.billing.find((item) => item.id === billingId)) {
                upToDateData[key] = storageData[key];
            } else {
                chrome.storage.local.remove(key);
            }
        }
    }

    if (storageData.hasOwnProperty("lastSentMessages")) {
        const now = new Date();
        let lastSentMessages = storageData["lastSentMessages"];

        for (key in lastSentMessages) {
            let lastSent = new Date(lastSentMessages[key]);
            // DELETE THE LOG OF MESSAGES SENT OVER 6 HOURS AGO
            if (getTimeDiff(now, lastSent, "h") >= 6) delete lastSentMessages[key];
        }

        upToDateData = {
            ...upToDateData,
            lastSentMessages: lastSentMessages,
        };
    }

    chrome.storage.local.set(upToDateData);
    newStorageData = await chrome.storage.local.get(null);
    return newStorageData;
}

async function getDataFromSite() {
    /*
        STORAGE STRUCTURE (KEY: VALUE)
        appData: { password: 'string', plugchatToken: 'string' },
        status: [
                {
                    id: 'id do status 1',
                    name: 'nome do status 1',
                },
                ...,
        ],
        billing: [
                {
                    id: 1,
                    name: 'Inserir pagamento',
                },
                {
                    id: 2,
                    name: 'Inserir desconto',
                },
                ...,
        ],
        status_idDoStatus1: {
                name: 'string',
                enabled: boolean,
                delayTime: 15,
                delayUnit: 'm',
                customerMessage: { type: 'string', content: 'string' },
                retailerMessage: { type: 'string', content: 'string' },
        },
        ...,
        billing_idDoBilling1: {
                enabled: boolean,
                delayTime: 15,
                delayUnit: 'm',
                customerMessage: { type: 'string', content: 'string' },
                retailerMessage: { type: 'string', content: 'string' },
        },
        ...,
        lastSentMessages: { '5521999999999' : '2021-01-01T12:00:00', ... },
        lastChange: '2021-01-01T12:00:00.458Z',
*/

    let statusSelectElement = null;
    let statusOptionElements = null;
    let urlToFetch = "";
    let result = {
        appData: {
            password: "",
            plugchatToken: "",
        },
        status: [],
        billing: [
            {
                id: "1",
                name: "Inserir pagamento",
            },
            {
                id: "2",
                name: "Inserir desconto",
            },
        ],
    };

    if (currentPage == "pedidos/home") {
        statusOptionElements = document.querySelector(
            "select.pedido-item-status-alterar"
        ).options;
    } else {
        urlToFetch = baseURL + "?imprimastore=pedidos/home";
        statusSelectElement = await fetchFromPage(
            urlToFetch,
            "select.pedido-item-status-alterar"
        );
        statusOptionElements = statusSelectElement.options;
    }

    if (!statusOptionElements) return false;

    for (let i = 0; i < statusOptionElements.length; i++) {
        result.status.push({
            id: statusOptionElements[i].value,
            name: statusOptionElements[i].text,
        });
    }

    return result;
}

async function fetchFromPage(url, selector) {
    if (!url || !selector) return;

    const response = await fetch(url);
    const pageData = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(pageData, "text/html");

    return doc.querySelector(selector);
}

function handleStatusChange() {
    const newStatusId = this.options[this.selectedIndex].value;
    const newStatusKey = "status_" + newStatusId;
    sendNotification(newStatusKey, this);
}

async function sendNotification(notificationKey, trigger) {
    const localData = await chrome.storage.local.get("deactivated");
    if (localData.deactivated) return;

    const storageData = await chrome.storage.local.get([
        notificationKey,
        "lastSentMessages",
    ]);

    const notificationData = storageData[notificationKey];
    const delayTime = notificationData?.delayTime ?? 15 * 60;
    const delayUnit = notificationData?.delayUnit ?? "s";
    let lastSentMessages = storageData?.lastSentMessages;

    if (!(notificationData && notificationData?.enabled)) return;

    let messageType = "text";
    let messageContent = "";

    let orderData = await getOrderData(trigger);

    if (
        lastSentMessages &&
        lastSentMessages.hasOwnProperty(orderData.customerPhone)
    ) {
        const now = new Date();
        const lastSent = new Date(lastSentMessages[orderData.customerPhone]);
        if (getTimeDiff(now, lastSent, delayUnit) < delayTime) {
            const delayTimeText = {
                s: `nos últimos ${notificationData.delayTime} segundos.`,
                m: `nos últimos ${notificationData.delayTime} minutos.`,
                h: `nas últimas ${notificationData.delayTime} horas.`,
            };
            const notificationMessage = `Uma notificação já foi enviada a esse cliente ${delayTimeText[delayUnit]}`;
            showAlert("Notificação não enviada.", notificationMessage, "warning");
            return;
        }
    }

    let userNameSplit = document
        .querySelector(".conteudo-navegacao-topo-perfil-nome")
        .innerText.split(" ");
    let userName = userNameSplit[0];

    const replacePlaceholders = {
        "{cliente}": orderData.customerName,
        "{npedido}": orderData.orderNumber,
        "{nitem}": orderData.itemNumber,
        "{produto}": orderData.orderTitle,
        "{nomearquivo}": orderData.fileName,
        "{qtde}": orderData.orderQuantity,
        "{vpagamento}": orderData.paymentValue,
        "{fpagamento}": orderData.paymentMethod,
        "{desconto}": orderData.discount,
        "{balcao}": orderData.withdrawal,
        "{link}": `https://www.angraficaimpacto.com.br/conta/pedido/${orderData.orderNumber.slice(
            1
        )}`,
        "{assinatura}": userName,
    };

    const paymentPlaceholders = ['{vpagamento}', '{fpagamento}', '{desconto}'];

    if (orderData.customerType == "Padrão") {
        messageType = notificationData.customerMessage.type;
        messageContent += notificationData.customerMessage.content;
    } else {
        messageType = notificationData.retailerMessage.type;
        messageContent += notificationData.retailerMessage.content;
    }

    for (let i = 0; i < paymentPlaceholders.length; i++) {
        if (
            messageContent.search(paymentPlaceholders[i]) >= 0
            && !replacePlaceholders[ paymentPlaceholders[i] ]
        ) {
            showAlert("Notificação não enviada.", "Usuário não tem acesso a valores.", "warning");
            return;
        }
    }

    messageContent = replaceString(messageContent, replacePlaceholders);

    if (messageContent == "") return;

    messageContent = `*${userName}:*\n` + `${messageContent}`;

    chrome.runtime.sendMessage(
        {
            contentScriptQuery: "sendNotification",
            notificationData: {
                phone: orderData.customerPhone,
                messageType: messageType,
                messageContent: messageContent,
            },
        },
        (response) => {
            if (response.zaapId && response.zaapId != "") {
                const now = new Date();
                let lastSentMessages = {};

                if (storageData.hasOwnProperty("lastSentMessages"))
                    lastSentMessages = storageData.lastSentMessages;

                lastSentMessages = {
                    ...lastSentMessages,
                    [orderData.customerPhone]: now.toISOString(),
                };

                chrome.storage.local.set({ lastSentMessages: lastSentMessages });

                showAlert(
                    "Notificação enviada.",
                    "O cliente receberá uma mensagem sobre essa alteração.",
                    "success"
                );
            }
        }
    );
}

async function getOrderData(el) {
    const regex = /[^0-9]/g;
    let selectedTr = el.closest("tr") ?? document.querySelector('.tabela:not(.tabela-pequena) tr');
    let doc = document;
    let itemNumber = "";
    let fileName = "";
    let withdrawal = "";

    if (
        location.href.includes("pedidos/detalhes") == false &&
        el.nodeName == "SELECT"
    ) {
        // SE O USUÁRIO NÃO ALTEROU O CAMPO STATUS NA PÁGINA
        // DE DETALHES DO PEDIDO, FAZ UM FETCH USANDO O LINK
        const selectedOrderPage = selectedTr.querySelector(".btn-pequeno").href;
        let response = await fetch(selectedOrderPage);
        let orderPageData = await response.text();
        const parser = new DOMParser();
        doc = parser.parseFromString(orderPageData, "text/html");
        itemNumber = selectedTr
            .querySelector("td.texto-centro p.texto-bold")
            .innerText.split(" ")[1];
        const fileNameRef = selectedTr.querySelector(".far.fa-file");
        fileName = fileNameRef ? fileNameRef.nextSibling.nodeValue : "";
        const orderItems = doc.querySelectorAll(".conteudo-fluido > .linha:nth-child(3) tr");
        orderItems.forEach(orderItem => {
            if (orderItem.querySelector('.texto-semibold').innerText == itemNumber)
                selectedTr = orderItem;
        });
        console.log(selectedTr);
    } else {
        itemNumber = selectedTr.querySelector(
            ".item-exibicao-ftp .texto-semibold"
        ).innerText;
        const fileNameRef = selectedTr.querySelector(".item-exibicao-noem");
        fileName = fileNameRef
            ? fileNameRef.querySelector(".texto-semibold").innerText
            : "";
    }
    const orderDetailsContainer = doc.querySelector(
        ".conteudo-pagina-titulo"
    ).nextElementSibling;
    const customerDetails = doc.querySelectorAll(
        ".conteudo-area-branca > .linha:nth-child(2) .bloco-paragrafo-linha p"
    );
    let customerPhone = '';
    customerDetails.forEach(detail => {
        if (detail.innerText.includes('Telefone'))
            customerPhone = "55" + detail.querySelector('span').innerText.replace(regex, "");
    });
    let orderTitle = selectedTr.querySelector(".texto-bold").innerText;
    if (orderTitle == "") {
        orderTitle = selectedTr.querySelector(".pb-10").innerText;
    }

    const paymentContainer = doc
        .querySelector(".fa.fa-donate")
        ?.closest(".linha.mb-40");
    const discountContainer = doc
        .querySelector(".fa.fa-tags")
        ?.closest(".linha.mb-40");
    const withdrawalContainerRef = orderDetailsContainer
        .querySelector(".fa.fa-map-marker-alt");

    if (withdrawalContainerRef) {
        const withdrawalContainer =
            withdrawalContainerRef.closest(".linha:not(.mb-10)");
        withdrawal =
            "Retirada: " +
            withdrawalContainer.querySelector(".bloco-paragrafo-linha p").innerText;
    } else {
        const deliveryContainer = orderDetailsContainer
            .querySelector(".fa.fa-shipping-fast")
            .closest(".linha:not(.mb-10)");
        withdrawal = deliveryContainer.querySelector(
            ".bloco-paragrafo-linha p"
        ).innerText;
    }

    const customerNameSplit = orderDetailsContainer.querySelector(".texto-grande a").innerText.split(" ");

    const orderData = {
        orderNumber: doc.querySelector(".pagina-titulo span").innerText,
        orderTitle: orderTitle,
        fileName: fileName,
        orderQuantity: selectedTr.querySelector("td:nth-child(3) .texto-semibold").innerText,
        itemNumber: itemNumber,
        customerName: customerNameSplit[0],
        customerType: orderDetailsContainer.querySelector(
            ".texto-grande ~ p:last-child span"
        ).innerText,
        customerPhone: customerPhone,
        paymentValue: paymentContainer?.querySelector('input[name="valor"]').value,
        paymentMethod: paymentContainer?.querySelector('select[name="forma"]').value,
        withdrawal: withdrawal,
        discount: discountContainer?.querySelector('input[name="valor"]').value,
    };

    return orderData;
}

function handleResponse(message) {
    console.log(message.response);
}

function handleError(error) {
    console.log(error);
}

function showAlert(title, message, type) {
    const oldAlert = document.querySelector("impacto-notificacoes-alert");
    if (oldAlert) {
        oldAlert.remove();
    }

    const container = document.getElementById("painel-geral");
    const alertElement = document.createElement("div");
    const alertTitle = document.createElement("strong");
    const alertTitleText = document.createTextNode(title);
    const alertTitleBr = document.createElement("br");
    const alertParagraph = document.createElement("p");
    const alertText = document.createTextNode(message);
    const alertButton = document.createElement("button");

    const colors = {
        success: "#02a499",
        error: "#ea2e4d",
        warning: "#f0ad4e",
    };
    const alertStyle = {
        position: "fixed",
        top: "120px",
        right: "20px",
        width: "320px",
        "border-radius": "5px",
        "box-shadow": "0 0 0 0 " + colors[type],
        animation: "pulse 1000ms",
        "animation-iteration-count": 5,
    };
    const alertButtonStyle = {
        display: "flex",
        padding: "8px",
        color: "#FFF",
        "background-color": "transparent",
        border: "none",
    };

    Object.assign(alertElement.style, alertStyle);
    Object.assign(alertButton.style, alertButtonStyle);
    alertParagraph.style.padding = "8px";

    alertElement.classList.add(
        "flex",
        `bg-${type}`,
        "impacto-notificacoes-alert"
    );
    alertButton.classList.add("fa", "fa-times");
    alertButton.setAttribute("type", "button");
    alertButton.setAttribute("aria-label", "Close");
    alertButton.addEventListener("click", function () {
        container.removeChild(alertElement);
    });

    alertTitle.appendChild(alertTitleText);
    alertParagraph.appendChild(alertTitle);
    alertParagraph.appendChild(alertTitleBr);
    alertParagraph.appendChild(alertText);
    alertElement.appendChild(alertParagraph);
    alertElement.appendChild(alertButton);

    container.appendChild(alertElement);
}

function replaceString(str, replaceMap) {
    Object.keys(replaceMap).forEach((key) => {
        str = str.replaceAll(key, replaceMap[key]);
    });

    return str;
}

function getTimeDiff(time1, time2, unit = "s") {
    let divisor = 1;
    switch (unit) {
        case "h":
            // 1h = 60m * 60s * 1000ms
            divisor = 3600000;
            break;

        case "m":
            // 1m = 60s * 1000ms
            divisor = 60000;
            break;

        case "s":
            // 1s = 1000ms
            divisor = 1000;
            break;
    }
    const timeDiff = Math.round((time1.getTime() - time2.getTime()) / divisor);
    return timeDiff;
}

chrome.runtime.onMessage.addListener(function (request) {
    if (request.message == "updateStorageData") {
        getAppData();
    }
});
