const statusSelects = document.querySelectorAll('select.pedido-item-status-alterar');

if (statusSelects)
{
    statusSelects.forEach((statusSelect) =>
    {
        statusSelect.addEventListener('change', handleStatusChange);
    });
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