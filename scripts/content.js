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

    if (appData == false)
    {
        throw "Não foi possível recuperar os dados";
    }
}

// const statusSelects = document.querySelectorAll('select.pedido-item-status-alterar');

// if (statusSelects)
// {
//     statusSelects.forEach((statusSelect) =>
//     {
//         statusSelect.addEventListener('change', handleStatusChange);
//     });
// }

async function getAppData()
{
    let storageData = await chrome.storage.sync.get(null);
    if (Object.keys(storageData).length > 0)
    {
        console.log(storageData);
        return storageData;
    }
    
    let siteData = await getDataFromSite();
    if (Object.keys(siteData).length > 0)
    {
        chrome.storage.sync.set( siteData );
        storageData = await chrome.storage.sync.get(null);
        if (Object.keys(storageData).length > 0)
        {
            return storageData;
        }   
    }

    return false;
}

async function getDataFromSite() {
    let statusSelectElement = null;
    let statusOptionElements = null;
    let paymentSelectElement = null;
    let paymentOptionElements = null;
    let urlToFetch = '';
    /*
        ESTRUTURA DO STORAGE (KEY: VALUE)
        appData: {
            password: 'string',
            plugchatToken: 'string',
        }
        status: [
            'nome do status',
        ],
        payments: [
            'nome da forma de pagamento',
        ],
        status_nomeDoStatus: {
            enabled: boolean,
            customerMessage: {
                type: 'string',
                content: 'string',
            },
            retailerMessage: {
                type: 'string',
                content: 'string',
            },
        }
        payment_nomeDaFormaDePagamento: {
            enabled: boolean,
            customerMessage: 'string',
            retailerMessage: 'string'
        }
        lastSentMessages: {
            '5521999999999' : '2021-01-01T12:00:00'
        }

        PARA NÃO ENVIAR MENSAGENS EM SEQUÊNCIA PARA UM MESMO NÚMERO:
        Criar setInterval no background.js para apagar de x em x minutos
        os registros de lastSentMessages que possuam data mais antiga
        que x minutos.
        Ao receber um request pra enviar mensagem, não enviar se o
        número de telefone estiver em lastSentMessages.
    */
    let result = {
        appData: {
            password: '',
            plugchatToken: '',
        },
        status : [],
        payments: [],
    };

    switch (currentPage)
    {
        case 'pedidos/home':
        case 'pedidos/detalhes':
            statusOptionElements = document.querySelector('select[name="status"]').options;

            urlToFetch = baseURL + '?imprimastore=pedidos/pagamentos';
            paymentSelectElement = await fetchFromPage(urlToFetch, 'select[name="forma"]')
            paymentOptionElements = paymentSelectElement.options;
        break;

        case 'pedidos/pagamentos':
            paymentOptionElements = document.querySelector('select[name="forma"]').options;

            urlToFetch = baseURL + '?imprimastore=pedidos/home';
            statusSelectElement = await fetchFromPage(urlToFetch, 'select[name="status"]');
            statusOptionElements = statusSelectElement.options;
        break;

        default:
            urlToFetch = baseURL + '?imprimastore=pedidos/home';
            statusSelectElement = await fetchFromPage(urlToFetch, 'select[name="status"]');
            statusOptionElements = statusSelectElement.options;

            urlToFetch = baseURL + '?imprimastore=pedidos/pagamentos';
            paymentSelectElement = await fetchFromPage(urlToFetch, 'select[name="forma"]')
            paymentOptionElements = paymentSelectElement.options;
        break;
    }

    // LOOPS COMEÇAM EM 1 PORQUE A OPÇÃO 0 É "TODOS"
    for (let i = 1; i < statusOptionElements.length; i++) {
        result.status.push(statusOptionElements[i].text);
    }

    for (let i = 1; i < paymentOptionElements.length; i++) {
        result.payments.push(paymentOptionElements[i].text);
    }

    return result;
}

async function fetchFromPage(url, selector) {
    if (! url || ! selector) return;

    const response = await fetch(url);
    const pageData = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(pageData, 'text/html');

    return( doc.querySelector(selector) );
}

async function handleStatusChange()
{
    const newStatus = this.options[this.selectedIndex].text;
    let customerPhoneNumber = await getCustomerPhoneNumber(this);
    const messageToSend = "Olá!\nO status do seu pedido foi atualizado para " + newStatus + ".\nSeu telefone é " + customerPhoneNumber;
    chrome.runtime.sendMessage(
    {
        contentScriptQuery: 'sendText',
        body:
        {
            phone: "5521988189988",
            message: messageToSend,
        }
    },
    (response) =>
    {
        console.log(response);
    });
}

async function getCustomerPhoneNumber(el)
{
    let customerPhoneNumber = '';

    if ( location.href.includes('pedidos/detalhes') )
    {
        // SE O USUÁRIO ALTEROU O CAMPO STATUS NA PÁGINA DOS DETALHES DO
        // PEDIDO, PEGA O TELEFONE NO LINK QUE ESTÁ NOS DADOS DO CLIENTE
        const customerPhoneLink = document.querySelector('[href*="phone="]')
                                          .href;
        customerPhoneNumber = customerPhoneLink.substr(-13);
    }
    else
    {
        // SENÃO, FAZ UM FETCH NA PÁGINA COM OS DADOS DO CLIENTE E PEGA
        // O TELEFONE DO CAMPO TELEFONE NO FORMULÁRIO
        const selectedCustomerPage = el.closest('tr')
                                       .querySelector('[href*="imprimastore=clientes"]')
                                       .href;
        let response = await fetch(selectedCustomerPage);
        let customerPageData = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(customerPageData, 'text/html');
        const regex = /[^0-9]/g;
        customerPhoneNumber = '55' + doc.querySelector('.inputFone')
                                        .value
                                        .replace(regex, '');
    }

    return customerPhoneNumber;
}

function handleResponse(message)
{
    console.log(message.response);
}

function handleError(error)
{
    console.log(error);
}