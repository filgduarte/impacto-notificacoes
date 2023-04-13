window.onload = async function()
{
    const storageData = await chrome.storage.sync.get(null);
    if (Object.keys(storageData).length > 0 ) {
        init();
        return;
    }

    chrome.tabs.query
    (
        {
            active: true,
            lastFocusedWindow: true,
        },
        function(tabs)
        {
            const activeTab = tabs[0];
            if( activeTab.url.search('https://www.angraficaimpacto.com.br/admin') == 0 ) {
                document.querySelector('.app-status__status .success').classList.add('active');
            }
        }
    );
}

async function init() {
    moveActiveTabMarker();

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
        
    const storageData = await chrome.storage.sync.get(['status', 'payments']);
 
    generateFields(storageData.status, 'status', '#status');
    generateFields(storageData.payments, 'payment', '#pagamentos');

    document.addEventListener('click', function(event)
    {
        if (event.target.classList.contains('button-placeholders'))
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
    })
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

    chrome.storage.sync.set(storageData);
}

async function handleSave(key, item) {
    let dataToSave = {
        enabled: item.querySelector('.switch-input').checked,
        customerMessage: {
            type: item.querySelector('.customer-message .message-type').value,
            content: item.querySelector('.customer-message .message-content').value,
        },
        retailerMessage: {
            type: item.querySelector('.retailer-message .message-type').value,
            content: item.querySelector('.retailer-message .message-content').value,
        }
    }

    await chrome.storage.sync.set( {[key] : dataToSave} );
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