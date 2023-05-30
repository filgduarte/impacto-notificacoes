const baseURL = location.href.split('?')[0];
const urlParams = new URLSearchParams(window.location.search);
const currentPage = urlParams.get('imprimastore');

if (currentPage)
{
    init();
}

async function init()
{
    let storageData = await getAppData();
    let appData = storageData.appData;

    if (storageData == false || appData == false)
    {        
        const errorMessage = 'Não foi possível recuperar os dados das notificações.'
        showAlert('Erro', errorMessage, 'danger');

        throw errorMessage;
    }

    const statusSelects = document.querySelectorAll('select.pedido-item-status-alterar');
    if (statusSelects)
    {
        statusSelects.forEach((statusSelect) =>
        {
            statusSelect.addEventListener('change', handleStatusChange);
        });
    }

    const paymentContainer = document.querySelector('.fa.fa-donate')?.closest('.linha.mb-40');
    if (paymentContainer)
    {
        const addPaymentBtn = paymentContainer.querySelector('.btn');
        addPaymentBtn?.addEventListener('click', function () {
            sendNotification("billing_Inserir pagamento", this)
        });
    }

    const discountContainer = document.querySelector('.fa.fa-tags')?.closest('.linha.mb-40');
    if (discountContainer)
    {
        const addDiscountBtn = discountContainer.querySelector('.btn');
        addDiscountBtn?.addEventListener('click', function () {
            sendNotification("billing_Inserir desconto", this)
        });
    }
}

async function getAppData()
{
    let storageData = await chrome.storage.sync.get(null);
    let siteData = await getDataFromSite();

    if (Object.keys(siteData).length == 0)
    {
        console.log('GRÁFICA IMPRIMA NOTIFICAÇÕES: Erro ao recuperar dados do site.');

        return storageData;
    }
    
    if (Object.keys(storageData).length == 0)
    {
        chrome.storage.sync.set( siteData );
        storageData = await chrome.storage.sync.get(null);

        return storageData;
    }

    let upToDateData = {
        appData: storageData.appData,
        status: siteData.status,
        billing: storageData.billing ?? siteData.billing,
    };
    
    for (key in storageData)
    {
        if (   key == 'appData'
            || key == 'status'
            || key == 'billing'
            || key == 'lastSentMessages'
            || key == 'lastChange'
        )
            continue;
        
        if (key.slice(0,6) == 'status')
        {
            let statusName = key.slice(7); // status_ -> 7 characters
                    
            if (siteData.status.includes(statusName))
            {
                upToDateData[key] = storageData[key];
            }
            else
            {
                chrome.storage.sync.remove(key);
            }
        }
        else
        {
            let billingName = key.slice(8);  // billing_ -> 8 characters
            
            if ( ! storageData.billing)
                continue;

            if (storageData.billing.includes(billingName))
            {
                upToDateData[key] = storageData[key];
            }
            else
            {
                chrome.storage.sync.remove(key);
            }
        }
    }

    if (storageData.hasOwnProperty('lastSentMessages'))
    {
        const now = new Date();        
        let lastSentMessages = storageData['lastSentMessages'];

        for (key in lastSentMessages)
        {
            let lastSent = new Date(lastSentMessages[key]);
            if (getTimeDiff(now, lastSent) >= 15)
                delete lastSentMessages[key];
        }

        upToDateData = {
            ...upToDateData,
            lastSentMessages: lastSentMessages,
        }
    }

    chrome.storage.sync.set( upToDateData );
    newStorageData = await chrome.storage.sync.get(null);
    return newStorageData;
}

async function getDataFromSite()
{
/*
    ESTRUTURA DO STORAGE (KEY: VALUE)
    appData: { password: 'string', plugchatToken: 'string' },
    status: [ 'nome do status 1', 'nome do status 2', ... ],
    billing : [ 'Inserir pagamento', 'Inserir desconto' ],
    status_nomeDoStatus1: {
        enabled: boolean,
        customerMessage: { type: 'string', content: 'string' },
        retailerMessage: { type: 'string', content: 'string' },
    },
    ...,
    billing_nomeDoItem1: {
        enabled: boolean,
        customerMessage: { type: 'string', content: 'string' },
        retailerMessage: { type: 'string', content: 'string' },
    },
    ...,
    lastSentMessages: { '5521999999999' : '2021-01-01T12:00:00', ... },
    lastChange: '2021-01-01T12:00:00.458Z',
*/

    let statusSelectElement = null;
    let statusOptionElements = null;
    let urlToFetch = '';
    let result = {
        appData: {
            password: '',
            plugchatToken: '',
        },
        status : [],
        billing : ['Inserir pagamento', 'Inserir desconto'],
    };

    if (currentPage == 'pedidos/home')
    {
        statusOptionElements = document.querySelector('select.pedido-item-status-alterar').options;
    }
    else
    {
        urlToFetch = baseURL + '?imprimastore=pedidos/home';
        statusSelectElement = await fetchFromPage(urlToFetch, 'select.pedido-item-status-alterar');
        statusOptionElements = statusSelectElement.options;
    }

    if ( ! statusOptionElements ) return false

    for (let i = 0; i < statusOptionElements.length; i++) {
        result.status.push(statusOptionElements[i].text);
    }

    return result;
}

async function fetchFromPage(url, selector)
{
    if (! url || ! selector) return;

    const response = await fetch(url);
    const pageData = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(pageData, 'text/html');

    return( doc.querySelector(selector) );
}

function handleStatusChange()
{
    const newStatus = this.options[this.selectedIndex].text;
    const newStatusKey = 'status_' + newStatus;
    sendNotification(newStatusKey, this);
}

function handleAddPayment()
{
    const newStatusKey = 'status_' + newStatus;
    sendNotification(newStatusKey, this);
}

async function sendNotification(notificationKey, trigger)
{
    const storageData = await chrome.storage.sync.get([notificationKey, 'lastSentMessages']);
    const notificationData = storageData[notificationKey];
    let lastSentMessages = storageData.lastSentMessages;

    if ( ! (notificationData && notificationData.enabled) )
        return;

    let messageType = 'text';
    let messageContent = '';

    let orderData = await getOrderData(trigger);

    if (lastSentMessages && lastSentMessages.hasOwnProperty(orderData.customerPhone))
    {
        const now = new Date();
        const lastSent = new Date(lastSentMessages[orderData.customerPhone]);
        if (getTimeDiff(now, lastSent) < 15)
        {
            showAlert('Notificação não enviada.', 'Uma notificação já foi enviada a esse cliente nos últimos 15 minutos.', 'warning');
            return;
        }
    }

    let userName = document.querySelector('.conteudo-navegacao-topo-perfil-nome').innerText;
    messageContent += "*" + userName + ":*\n";

    const replacePlaceholders =
    {
        '{nome}' : orderData.customerName,
        '{npedido}' : orderData.orderNumber,
        '{nitem}' : orderData.itemNumber,
        '{titulo}' : orderData.orderTitle,
        '{cores}' : orderData.orderColors,
        '{material}' : orderData.orderMaterial,
        '{formato}' : orderData.orderSize,
        '{acabamento}' : orderData.orderFinishing,
        '{revestimento}' : orderData.orderCover,
        '{extras}' : orderData.orderExtras,
        '{qtde}' : orderData.orderQuantity,
        '{vpagamento}' : orderData.paymentValue,
        '{fpagamento}' : orderData.paymentMethod,
        '{desconto}' : orderData.discount,
    }
    if (orderData.customerType == 'Padrão')
    {
        messageType = notificationData.customerMessage.type;
        messageContent += replaceString(notificationData.customerMessage.content, replacePlaceholders);
    }
    else
    {
        messageType = notificationData.retailerMessage.type;
        messageContent += replaceString(notificationData.retailerMessage.content, replacePlaceholders);
    }

    if (messageContent == '')
        return;

    chrome.runtime.sendMessage(
    {
        contentScriptQuery: 'sendNotification',
        notificationData:
        {
            phone: orderData.customerPhone,
            messageType: messageType,
            messageContent: messageContent,
        }
    },
    (response) =>
    {
        if (response.zaapId && response.zaapId != '')
        {
            const now = new Date();
            let lastSentMessages = {};

            if (storageData.hasOwnProperty('lastSentMessages'))
                lastSentMessages = storageData.lastSentMessages;

            lastSentMessages = {
                ...lastSentMessages,
                [orderData.customerPhone] : now.toISOString(),
            }
            
            chrome.storage.sync.set( {lastSentMessages: lastSentMessages} );

            showAlert('Notificação enviada.', 'O cliente receberá uma mensagem sobre essa alteração.', 'success');
        }
    });
}

async function getOrderData(el)
{
    let doc = document;
    const selectedTr = el.closest('tr');

    const regex = /[^0-9]/g;
    let itemNumber = '';

    if ( location.href.includes('pedidos/detalhes') == false
         && el.nodeName == 'SELECT'
       )
    {
        // SE O USUÁRIO NÃO ALTEROU O CAMPO STATUS NA PÁGINA
        // DE DETALHES DO PEDIDO, FAZ UM FETCH USANDO O LINK
        const selectedOrderPage = selectedTr.querySelector('.btn-pequeno').href;
        let response = await fetch(selectedOrderPage);
        let orderPageData = await response.text();
        const parser = new DOMParser();
        doc = parser.parseFromString(orderPageData, 'text/html');
        itemNumber = selectedTr.querySelector('td.texto-centro p.texto-bold').innerText.split(' ')[1];
    }
    else
    {
        itemNumber = selectedTr.querySelector('.item-exibicao-ftp .texto-semibold').innerText;
    }
    
    const customerPhoneElement = doc.querySelector('.conteudo-area-branca > .linha:nth-child(2) .bloco-paragrafo-linha p:nth-child(4) span');

    let orderTitle = doc.querySelector('.conteudo-fluido > .linha:nth-child(3) .texto-bold').innerText;
    if (orderTitle == '')
    {
        orderTitle = doc.querySelector('.conteudo-fluido > .linha:nth-child(3) .pb-10').innerText;
    }

    const paymentContainer = doc.querySelector('.fa.fa-donate').closest('.linha.mb-40');
    const discountContainer = doc.querySelector('.fa.fa-tags').closest('.linha.mb-40');

    const orderData =
    {
        orderNumber: doc.querySelector('.pagina-titulo span').innerText,
        orderTitle: orderTitle,
        // orderColors: '',
        // orderMaterial: '',
        // orderSize: '',
        // orderFinishing: '',
        // orderCover: '',
        // orderExtras: '',
        orderQuantity: doc.querySelector('.conteudo-fluido > .linha:nth-child(3) td:nth-child(3) .texto-semibold').innerText,
        itemNumber: itemNumber,
        customerName: doc.querySelector('.texto-grande a').innerText,
        customerType: doc.querySelector('.texto-grande ~ p:last-child span').innerText,
        customerPhone: '55' + customerPhoneElement.innerText.replace(regex, ''),
        paymentValue: paymentContainer.querySelector('input[name="valor"]').value,
        paymentMethod: paymentContainer.querySelector('select[name="forma"]').value,
        discount: discountContainer.querySelector('input[name="valor"]').value,
    };

    return orderData;
}

function handleResponse(message)
{
    console.log(message.response);
}

function handleError(error)
{
    console.log(error);
}

function showAlert(title, message, type) {
    const oldAlert = document.querySelector('impacto-notificacoes-alert');
    if (oldAlert)
    {
        oldAlert.remove();
    }

    const container = document.getElementById('painel-geral');
    const alertElement = document.createElement('div');
    const alertTitle = document.createElement('strong');
    const alertTitleText = document.createTextNode(title);
    const alertTitleBr = document.createElement('br');
    const alertParagraph = document.createElement('p');
    const alertText = document.createTextNode(message);
    const alertButton = document.createElement('button');

    const colors = {
        'success' : '#02a499',
        'error' : '#ea2e4d',
        'warning' : '#f0ad4e',
    }
    const alertStyle = {
        'position' : 'fixed',
        'top' : '120px',
        'right' : '20px',
        'width' : '320px',
        'border-radius' : '5px',
        'box-shadow' : '0 0 0 0 ' + colors[type],
        'animation' : 'pulse 1000ms',
        'animation-iteration-count' : 5,
    }
    const alertButtonStyle = {
        'display' : 'flex',
        'padding' : '8px',
        'color' : '#FFF',
        'background-color' : 'transparent',
        'border' : 'none',
    }

    Object.assign(alertElement.style, alertStyle);
    Object.assign(alertButton.style, alertButtonStyle);
    alertParagraph.style.padding = '8px';

    alertElement.classList.add('flex', `bg-${type}`, 'impacto-notificacoes-alert');
    alertButton.classList.add('fa', 'fa-times');
    alertButton.setAttribute('type', 'button');
    alertButton.setAttribute('aria-label', 'Close');
    alertButton.addEventListener('click', function() {
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

function replaceString(str, replaceMap)
{
    Object.keys(replaceMap).forEach( (key) => {
        str = str.replaceAll(key, replaceMap[key]);
    });

    return str;
}

function getTimeDiff(time1, time2)
{
    const timeDiff = Math.round( (time1.getTime() - time2.getTime()) / 60000 );
    return timeDiff;
}

chrome.runtime.onMessage.addListener(
    function(request)
    {
        if (request.message == 'updateStorageData')
        {
            getAppData();
        }
    }
)