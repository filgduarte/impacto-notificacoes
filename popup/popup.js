moveActiveTabMarker();

document.querySelectorAll('nav button').forEach((navLink) => {
    navLink.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelector('nav button.active').classList.remove('active');
        this.classList.add('active');
        moveActiveTabMarker()
        goToSection(this.dataset.target);
    })
})

function moveActiveTabMarker() {
    const activeTab = document.querySelector('nav button.active');
    const activeTabMarker = document.getElementById('active-tab-marker');
    activeTabMarker.style.width = activeTab.offsetWidth + 'px';
    activeTabMarker.style.left = activeTab.offsetLeft + 'px';
}

function goToSection(section = null) {
    const targetSectionSelector = section ?? 'section.active';
    const targetSection = document.querySelector(targetSectionSelector);
    document.querySelector('main').style.transform = `translateX(-${targetSection.offsetLeft}px)`;
}