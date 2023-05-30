window.onload = async function()
{
    const storageData = await getStorageData();
    const statusOK = await getStatus(storageData);

    if (statusOK)
        init(storageData);
    else
        handleConfigSubmit();    
}

function init(storageData) {
    handleLock(storageData);
    handleConfigSubmit();
    setTabsActions();
    generateFields(storageData.status, 'status', '#status');
    generateFields(storageData.billing, 'billing', '#financeiro');
    handlePlaceholderButtons();
    document.getElementById('token-field').value = storageData.appData.plugchatToken;
}

async function getStorageData()
{
    const [adminTab] = await chrome.tabs.query({url: 'https://www.angraficaimpacto.com.br/admin/?*'});

    if (adminTab)
        await chrome.tabs.sendMessage(adminTab.id, {message: 'updateStorageData'});

    result = await chrome.storage.sync.get(null);

    return result;
}

async function getStatus(storageData) {
    const userInfo = await chrome.identity.getProfileUserInfo();
    const [adminTab] = await chrome.tabs.query({url: 'https://www.angraficaimpacto.com.br/admin/?*'});
    let hasApiToken = false;
    let hasPassword = false;
    let hasSync = false;
    let isSiteOpen = false;

    if ( storageData.hasOwnProperty('appData') )
    {

        if ( storageData.appData.plugchatToken != '' )
        {
            hasApiToken = true;
            const apikeyStatusSpan = document.querySelector('.app-status__key .status-info');
            apikeyStatusSpan.querySelector('.fail').classList.remove('active');
            apikeyStatusSpan.querySelector('.success').classList.add('active');
        }

        if ( storageData.appData.password && storageData.appData.password != '' )
        {
            hasPassword = true;
        }
    }

    if ( hasApiToken == false || hasPassword == false )
    {
        // Se não houver chave de API ou senha configurada,
        // manda pra tela de configuração
        document.getElementById('popup-container').classList.add('no-password');
        return
    }
    else
    {
        // Se houver, exibe apenas a tela inicial
        // e campo de senha para liberar o resto
        document.getElementById('popup-container').classList.remove('no-password');
        document.getElementById('popup-container').classList.add('locked');
    }

    if ( storageData.lastChange && storageData.lastChange != '' )
    {
        const lastChange = new Date(storageData.lastChange);
        const lastChangeDate = lastChange.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
        const lastChangeTime = lastChange.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        const lastChangeStatusSpan = document.querySelector('.app-status__last-change .status-info');
        const lastChangeDateSpan = lastChangeStatusSpan.querySelector('.date');
        lastChangeStatusSpan.querySelector('.warning').classList.remove('active');
        lastChangeDateSpan.innerText = lastChangeDate + ' às ' + lastChangeTime;
        lastChangeDateSpan.classList.add('active');
    }

    if (userInfo.id)
    {
        hasSync = true;
        const syncStatusSpan = document.querySelector('.app-status__sync .status-info');
        syncStatusSpan.querySelector('.fail').classList.remove('active');
        syncStatusSpan.querySelector('.success').classList.add('active');
    }
    else
    {
        // Se o usuário não estiver logado no navegador
        // trava a utilização do popup
        document.getElementById('popup-container').classList.add('blocked');
    }

    // Verifica se o painel de administração do site está aberto na aba ativa
    if (adminTab && adminTab.active)
    {
        isSiteOpen = true;
        const linkStatusSpan = document.querySelector('.app-status__link .status-info');
        linkStatusSpan.querySelector('.fail').classList.remove('active');
        linkStatusSpan.querySelector('.success').classList.add('active');
    }
    else
    {
        // Se a aba ativa não for a do painel de administração
        // trava a utilização do popup
        document.getElementById('popup-container').classList.add('blocked');
    }

    if (hasApiToken && hasPassword && hasSync && isSiteOpen)
        return true;
    else
        return false;
}

function handleLock(storageData)
{
    document.getElementById('lock-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const rawFormData = new FormData(event.target);
        const formPassword = encodeURIComponent(rawFormData.get('password'));
        const hashedPassword = await hashPassword(formPassword);

        if (hashedPassword === storageData.appData.password)
        {
            document.getElementById('popup-container').classList.remove('locked');
            moveActiveTabMarker();
        }
        else
        {
            alert('Senha incorreta');
        }
    });
}

function handleConfigSubmit(storageData) {
    document.querySelector('.export-import .export').addEventListener('click', e => {
        e.preventDefault();
        downloadFile(
            JSON.stringify(storageData),
            'impacto-notificacoes.json',
            'text-json'
        );
    });
    document.querySelector('.export-import .import').addEventListener('change', e => {
        importFile(e, e.target.files)
    });

    document.querySelector('#configuracoes form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const rawFormData = new FormData(event.target);
        const formData = {};
        const storageData = await getStorageData();
        let currentAppData = {
            password: '',
            plugchatToken: '',
        }
        let newAppData = {}
        let errors = [];

        if ( ! document.querySelector('.no-password') )
        {
            Object.assign(currentAppData, storageData.appData);
        }

        Object.assign(newAppData, currentAppData);

        for (let [name, value] of rawFormData)
        {
            formData[name] = encodeURIComponent(value);
        }

        if (formData.newPassword == '') {
            if ( currentAppData.password == '' )
            {
                errors.push('• Você precisa definir uma senha para utilizar a extensão.');
            }
        }
        else
        {
            if ( formData.newPassword == formData.newPasswordConfirm )
            {
                if ( decodeURIComponent(formData.newPassword).length >= 8
                    && decodeURIComponent(formData.newPassword).length <= 16 )
                {
                    newAppData.password = await hashPassword(formData.newPassword);
                }
                else
                {
                    errors.push('• A senha precisa ter de 8 a 16 caracteres.');
                }
                
            }
            else
            {
                errors.push('• As senhas dos campos "Nova senha" e "Confirme a nova senha" não são iguais');
            }
        }

        if ( formData.plugchatToken == '')
        {
            if ( currentAppData.plugchatToken == '' )
            {
                errors.push('• Você precisa fornecer uma chave de API do Plug Chat para utilizar a extensão.');
            }
        }
        else
        {
            if ( formData.plugchatToken != currentAppData.plugchatToken )
            {
                newAppData.plugchatToken = formData.plugchatToken;
            }
        }

        if ( currentAppData.password != ''
            && formData.password != currentAppData.password )
        {
            errors.push('• Digite a senha atual para salvar as alterações.');
        }

        if ( errors.length == 0 )
        {
            if ( confirm('Deseja salvar as alterações?') == false )
            {
                return
            }

            saveToStorage({ appData: newAppData });

            location.reload();
        }
        else
        {
            alert(errors.join("\n"));
        }
    });
}

function setTabsActions() {
    document.querySelectorAll('nav button')
        .forEach(
            function(navLink)
            {
                navLink.addEventListener(
                    'click',
                    function(e)
                    {
                        e.preventDefault();
                        document.querySelector('nav button.active').classList.remove('active');
                        this.classList.add('active');
                        moveActiveTabMarker()
                        goToSection(this.dataset.target);
                    }
                );
            }
        );
}

function moveActiveTabMarker()
{
    const activeTab = document.querySelector('nav button.active');
    const activeTabMarker = document.getElementById('active-tab-marker');
    activeTabMarker.style.width = activeTab.offsetWidth + 'px';
    activeTabMarker.style.left = activeTab.offsetLeft + 'px';
}

function goToSection(section = null)
{
    const targetSectionSelector = section ?? 'section.active';
    const targetSection = document.querySelector(targetSectionSelector);
    document.querySelector('main').style.transform = `translateX(-${targetSection.offsetLeft}px)`;
}

async function generateFields(fields, category, sectionId)
{
    const accordeon = document.querySelector(`${sectionId} .accordeon`);
    const originalAccordeonItem = accordeon.querySelector(`.accordeon-item`);

    for (let i = 0; i < fields.length; i++)
    {
        const accordeonItem = originalAccordeonItem.cloneNode(true);
        const itemDataKey = category + '_' + fields[i];
        const storageData = await chrome.storage.sync.get(itemDataKey);
        const itemData = storageData[itemDataKey];
        const itemSwitch = accordeonItem.querySelector('.switch-input');

        accordeonItem.querySelector('.status-title').innerHTML = fields[i];
        itemSwitch.setAttribute('name', fields[i]);
        itemSwitch.addEventListener('change', (event) => handleSwitchClick(event, itemDataKey));

        if ( itemData )
        {
            itemSwitch.checked = itemData.enabled;

            accordeonItem.querySelector('.customer-message .message-type').value = itemData.customerMessage.type;
            accordeonItem.querySelector('.customer-message .message-content').value = itemData.customerMessage.content;
            accordeonItem.querySelector('.retailer-message .message-type').value = itemData.retailerMessage.type;
            accordeonItem.querySelector('.retailer-message .message-content').value = itemData.retailerMessage.content;
        }

        accordeonItem.querySelector('.edit-button')
            .addEventListener(
                'click',
                function ()
                {
                    document.querySelector('.accordeon-item.active')?.classList.remove('active');
                    accordeonItem.classList.add('active');
                    accordeonItem.addEventListener('transitionend', function()
                    {
                        document.querySelector(sectionId).scrollTo(0, accordeonItem.offsetTop);
                    });
                }
            );

        accordeonItem.querySelector('.cancel-button')
            .addEventListener(
                'click',
                function ()
                {
                    this.closest('.accordeon-item').classList.remove('active');
                }
            );
        
        accordeonItem.querySelectorAll('button.format-item').forEach(formatButton => {
            const buttonParent = formatButton.closest('.textarea');
            const targetTextarea = buttonParent.querySelector('.message-content');
            const wrapperChar = formatButton.dataset.wrapperChar;
            formatButton.addEventListener('click', function()
            {
                wrapText(targetTextarea, wrapperChar);
            });
        });

        accordeonItem.querySelectorAll('.button-placeholders').forEach(placeholderButton => {
            placeholderButton.addEventListener('click', function()
            {
                placeholderButton.classList.toggle('active');
            });
        });

        accordeonItem.querySelectorAll('li.placeholder-item').forEach(item => {
            const itemParent = item.closest('.textarea');
            const targetTextarea = itemParent.querySelector('.message-content');
            const placeholder = item.innerText;
            item.addEventListener('click', function()
            {
                addPlaceholder(targetTextarea, placeholder);
            });
        });
        
        accordeonItem.querySelector('button.success')
            .addEventListener('click',() => handleSave(itemDataKey, accordeonItem));

        accordeon.appendChild(accordeonItem);
    }

    accordeon.removeChild(originalAccordeonItem);
}

async function handleSwitchClick(event, key)
{
    let storageData = await chrome.storage.sync.get(key);

    if ( ! storageData[key]) {
        storageData[key] = {
            customerMessage:
            {
                type: 'text',
                content: '',
            },
            retailerMessage:
            {
                type: 'text',
                content: '',
            },
        };
    }

    storageData[key].enabled = event.target.checked;
    saveToStorage(storageData);
}

function handlePlaceholderButtons() {
    document.addEventListener('click', function(event)
    {
        if (event.target.classList.contains('button-placeholders')
            || event.target.classList.contains('gg-caret-down'))
        {
            return;
        }

        const activePlaceholderButtons = document.querySelectorAll('.button-placeholders.active');
        if (activePlaceholderButtons.length > 0)
        {
            activePlaceholderButtons.forEach(button => {
                button.classList.remove('active');
            })
        }
    });
}

function handleSave(key, item) {
    let dataToSave = 
    {
    [key] : {
                enabled: item.querySelector('.switch-input').checked,
                customerMessage: {
                    type: item.querySelector('.customer-message .message-type').value,
                    content: item.querySelector('.customer-message .message-content').value,
                },
                retailerMessage: {
                    type: item.querySelector('.retailer-message .message-type').value,
                    content: item.querySelector('.retailer-message .message-content').value,
                }
            },
    };

    saveToStorage(dataToSave);
    document.querySelector('.accordeon-item.active')?.classList.remove('active');
}

function wrapText(target, wrapperChar) {
    const selectionStart = target.selectionStart;
    const selectionEnd = target.selectionEnd;
    let textOriginalValue = target.value;

    target.value = textOriginalValue.slice(0, selectionStart)
                   + wrapperChar
                   + textOriginalValue.slice(selectionStart, selectionEnd)
                   + wrapperChar
                   + textOriginalValue.slice(selectionEnd);
}

function addPlaceholder(target, placeholder) {
    const selectionStart = target.selectionStart;
    const selectionEnd = target.selectionEnd;
    let textOriginalValue = target.value;

    target.value = textOriginalValue.slice(0, selectionStart)
                   + placeholder
                   + textOriginalValue.slice(selectionEnd);
}

function saveToStorage(data)
{
    const now = new Date();
    data.lastChange = now.toISOString();

    chrome.storage.sync.set(data);
}

function downloadFile(data, fileName, fileType) {
    const blob = new Blob([data], { type: fileType});
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = fileName;

    const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
    });
    a.dispatchEvent(clickEvent);
    a.remove();
}

function importFile(event, file) {
    if (!file) {
        alert('Nenhum arquivo selecionado.');
        return
    }

    const reader = new FileReader();
    reader.readAsText(file[0]);

    reader.onload = function() {
        const importedJson = JSON.parse( reader.result );
        if (importedJson)
        {
            saveToStorage(importedJson);
            location.reload();           
        }
    }

    event.currentTarget.value = '';
}

async function hashPassword(password) {
    const userInfo = await chrome.identity.getProfileUserInfo();
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const saltData = encoder.encode(userInfo.id).buffer;

    const concatenatedData = new Uint8Array(saltData.byteLength + data.byteLength);
    concatenatedData.set(new Uint8Array(saltData), 0);
    concatenatedData.set(new Uint8Array(data), saltData.byteLength);

    const hashBuffer = await crypto.subtle.digest('SHA-256', concatenatedData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

    return hashHex;
}