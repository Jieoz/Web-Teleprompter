(() => {
    'use strict';

    const EDGE_THRESHOLD = 48;
    const EDGE_HIDE_DELAY = 400;
    const BASE_SCROLL_VELOCITY = 60;
    const POSITION_NUDGE = 120;
    const NUDGE_ANIMATION_DURATION = 280;
    const NUDGE_HOLD_INITIAL_DELAY = 260;
    const NUDGE_HOLD_INTERVAL = 180;
    const MIN_SPEED = 0.1;
    const MAX_SPEED = 5;
    const MIN_FONT_SIZE = 20;
    const MAX_FONT_SIZE = 120;

    let isPlaying = false;
    let scrollSpeed = 1;
    let scrollDirection = 'up';
    let animationId = null;
    let currentPosition = 0;
    let textHeight = 0;
    let containerHeight = 0;
    let isFullscreen = false;
    let controlsPinned = true;
    let controlsVisible = true;
    let lastTimestamp = null;
    let controlsVisibleBeforeFullscreen = true;
    let pinStateBeforeFullscreen = true;
    let pinStateBeforePlay = true;
    let headerHideTimer = null;
    let nudgeAnimationFrame = null;
    let nudgeAnimationStart = null;
    let nudgeStartPosition = 0;
    let nudgeTargetPosition = 0;
    let controlPanelHideTimer = null;
    let footerHideTimer = null;
    let statusHideTimer = null;
    let statusMessageTimer = null;
    let baseStatusMessage = '';
    let isApplyingSettings = false;
    let nudgeHoldDirection = null;
    let nudgeHoldTimeout = null;
    let nudgeHoldInterval = null;

    const header = document.getElementById('header');
    const mainContainer = document.getElementById('mainContainer');
    const controlPanel = document.getElementById('controlPanel');
    const teleprompterArea = document.getElementById('teleprompterArea');
    const editMode = document.getElementById('editMode');
    const playMode = document.getElementById('playMode');
    const statusBar = document.getElementById('statusBar');
    const fullscreenControls = document.getElementById('fullscreenControls');
    const textInput = document.getElementById('textInput');
    const teleprompterText = document.getElementById('teleprompterText');

    const importTextBtn = document.getElementById('importTextBtn');
    const exportTextBtn = document.getElementById('exportTextBtn');
    const clearTextBtn = document.getElementById('clearTextBtn');
    const playBtn = document.getElementById('playBtn');
    const resetBtn = document.getElementById('resetBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const pinPanelBtn = document.getElementById('pinPanelBtn');

    const speedRange = document.getElementById('speedRange');
    const speedValue = document.getElementById('speedValue');
    const directionSelect = document.getElementById('directionSelect');
    const fontSizeRange = document.getElementById('fontSizeRange');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const fontFamilySelect = document.getElementById('fontFamilySelect');
    const textColorPicker = document.getElementById('textColorPicker');
    const bgColorPicker = document.getElementById('bgColorPicker');
    const lineHeightRange = document.getElementById('lineHeightRange');
    const lineHeightValue = document.getElementById('lineHeightValue');
    const framePaddingRange = document.getElementById('framePaddingRange');
    const framePaddingValue = document.getElementById('framePaddingValue');
    const alignmentSelect = document.getElementById('alignmentSelect');
    const fileInput = document.getElementById('fileInput');

    const speedDownBtn = document.getElementById('speedDownBtn');
    const togglePlayFloatingBtn = document.getElementById('togglePlayFloatingBtn');
    const speedUpBtn = document.getElementById('speedUpBtn');
    const resetFloatingBtn = document.getElementById('resetFloatingBtn');
    const backToEditBtn = document.getElementById('backToEditBtn');

    init();

    function init() {
        document.body.classList.add('panel-pinned');
        registerEventListeners();
        loadText();
        loadSettings();
        updateStatus();
        updatePanelPinButton();
        showControlPanel({ immediate: true });
        showHeader();
        showStatusBar();
        setTimeout(() => {
            if (!controlsPinned) {
                hideControlPanel({ immediate: true });
            }
            hideHeader();
        }, 2500);
    }

    function registerEventListeners() {
        importTextBtn.addEventListener('click', () => fileInput.click());
        exportTextBtn.addEventListener('click', exportText);
        clearTextBtn.addEventListener('click', clearText);
        playBtn.addEventListener('click', togglePlay);
        resetBtn.addEventListener('click', resetPosition);
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        pinPanelBtn.addEventListener('click', toggleControlPanelPin);

        speedRange.addEventListener('input', (event) => updateSpeed(event.target.value));
        directionSelect.addEventListener('change', (event) => updateDirection(event.target.value));
        fontSizeRange.addEventListener('input', (event) => updateFontSize(parseInt(event.target.value, 10)));
        fontFamilySelect.addEventListener('change', (event) => updateFontFamily(event.target.value));
        textColorPicker.addEventListener('input', (event) => updateTextColor(event.target.value));
        bgColorPicker.addEventListener('input', (event) => updateBgColor(event.target.value));
        lineHeightRange.addEventListener('input', (event) => updateLineHeight(parseFloat(event.target.value)));
        framePaddingRange.addEventListener('input', (event) => updateFramePadding(event.target.value));
        alignmentSelect.addEventListener('change', (event) => updateAlignment(event.target.value));

        fileInput.addEventListener('change', handleFileUpload);
        textInput.addEventListener('input', () => saveText());

        speedDownBtn.addEventListener('click', () => adjustSpeed(-0.1));
        togglePlayFloatingBtn.addEventListener('click', togglePlay);
        speedUpBtn.addEventListener('click', () => adjustSpeed(0.1));
        resetFloatingBtn.addEventListener('click', resetPosition);
        backToEditBtn.addEventListener('click', exitPlayMode);

        document.addEventListener('mousemove', handleEdgeHover);
        document.addEventListener('mouseleave', () => {
            hideHeader(true);
            hideStatusBar(true);
            scheduleHideControlPanel();
            scheduleHideFooterControls();
        });

        document.addEventListener('keydown', handleKeydown);
        document.addEventListener('keyup', handleKeyup);

        window.addEventListener('blur', () => stopNudgeHold());

        window.addEventListener('resize', () => {
            if (playMode.classList.contains('active')) {
                recomputeLayout({ preserveProgress: true });
            }
        });

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }

    function handleEdgeHover(event) {
        const { clientX, clientY } = event;
        const nearTop = clientY <= EDGE_THRESHOLD;
        const nearLeft = clientX <= EDGE_THRESHOLD;
        const nearBottom = window.innerHeight - clientY <= EDGE_THRESHOLD;

        if (nearTop) {
            showHeader();
        } else {
            hideHeader();
        }

        if (controlsPinned || nearLeft) {
            showControlPanel();
        } else {
            scheduleHideControlPanel();
        }

        if (playMode.classList.contains('active')) {
            if (nearBottom) {
                showFooterControls();
            } else {
                scheduleHideFooterControls();
            }
        } else {
            fullscreenControls.classList.remove('edge-visible');
        }
    }

    function showHeader() {
        if (headerHideTimer) {
            clearTimeout(headerHideTimer);
            headerHideTimer = null;
        }
        if (!header.classList.contains('edge-visible')) {
            header.classList.add('edge-visible');
        }
        showStatusBar();
    }

    function hideHeader(immediate = false) {
        if (headerHideTimer) {
            clearTimeout(headerHideTimer);
            headerHideTimer = null;
        }
        const hideAction = () => {
            header.classList.remove('edge-visible');
        };
        if (immediate) {
            hideAction();
        } else {
            headerHideTimer = setTimeout(hideAction, EDGE_HIDE_DELAY);
        }
    }

    function showStatusBar() {
        if (statusHideTimer) {
            clearTimeout(statusHideTimer);
            statusHideTimer = null;
        }
        statusBar.classList.add('edge-visible');
    }

    function hideStatusBar(immediate = false) {
        if (statusHideTimer) {
            clearTimeout(statusHideTimer);
            statusHideTimer = null;
        }
        if (statusMessageTimer) {
            clearTimeout(statusMessageTimer);
            statusMessageTimer = null;
        }
        const hideAction = () => statusBar.classList.remove('edge-visible');
        if (immediate) {
            hideAction();
        } else {
            statusHideTimer = setTimeout(hideAction, EDGE_HIDE_DELAY);
        }
    }

    function setStatusMessage(message) {
        if (!message) {
            hideStatusBar(true);
            return;
        }
        statusBar.textContent = message;
        showStatusBar();
    }

    function flashStatus(message, duration = 2000) {
        setStatusMessage(message);
        if (statusMessageTimer) {
            clearTimeout(statusMessageTimer);
            statusMessageTimer = null;
        }
        statusMessageTimer = setTimeout(() => {
            statusMessageTimer = null;
            if (baseStatusMessage) {
                statusBar.textContent = baseStatusMessage;
                showStatusBar();
            } else {
                hideStatusBar(true);
            }
        }, duration);
    }

    function showControlPanel({ immediate = false } = {}) {
        if (controlPanelHideTimer) {
            clearTimeout(controlPanelHideTimer);
            controlPanelHideTimer = null;
        }
        if (!controlsVisible || immediate) {
            controlPanel.classList.add('edge-visible');
            controlsVisible = true;
        }
        if (controlsPinned) {
            document.body.classList.add('panel-pinned');
        } else {
            document.body.classList.remove('panel-pinned');
        }
    }

    function scheduleHideControlPanel() {
        if (controlsPinned) {
            return;
        }
        if (controlPanelHideTimer) {
            clearTimeout(controlPanelHideTimer);
        }
        controlPanelHideTimer = setTimeout(() => {
            controlPanel.classList.remove('edge-visible');
            controlsVisible = false;
            document.body.classList.remove('panel-pinned');
        }, EDGE_HIDE_DELAY);
    }

    function hideControlPanel({ immediate = false } = {}) {
        if (controlsPinned) {
            return;
        }
        if (controlPanelHideTimer) {
            clearTimeout(controlPanelHideTimer);
            controlPanelHideTimer = null;
        }
        const hideAction = () => {
            controlPanel.classList.remove('edge-visible');
            controlsVisible = false;
            document.body.classList.remove('panel-pinned');
        };
        if (immediate) {
            hideAction();
        } else {
            controlPanelHideTimer = setTimeout(hideAction, EDGE_HIDE_DELAY);
        }
    }

    function showFooterControls() {
        if (footerHideTimer) {
            clearTimeout(footerHideTimer);
            footerHideTimer = null;
        }
        if (!fullscreenControls.classList.contains('edge-visible')) {
            fullscreenControls.classList.add('edge-visible');
        }
    }

    function scheduleHideFooterControls() {
        if (footerHideTimer) {
            clearTimeout(footerHideTimer);
        }
        footerHideTimer = setTimeout(() => {
            fullscreenControls.classList.remove('edge-visible');
        }, EDGE_HIDE_DELAY);
    }

    function toggleControlPanelPin() {
        setControlPanelPinned(!controlsPinned);
    }

    function setControlPanelPinned(pinned) {
        controlsPinned = pinned;
        updatePanelPinButton();

        if (controlsPinned) {
            showControlPanel({ immediate: true });
            document.body.classList.add('panel-pinned');
        } else {
            document.body.classList.remove('panel-pinned');
            hideControlPanel({ immediate: true });
        }

        if (playMode.classList.contains('active')) {
            recomputeLayout({ preserveProgress: true });
        }
    }

    function updatePanelPinButton() {
        if (!pinPanelBtn) {
            return;
        }
        if (controlsPinned) {
            pinPanelBtn.textContent = '启用自动隐藏';
            pinPanelBtn.setAttribute('aria-pressed', 'true');
        } else {
            pinPanelBtn.textContent = '固定控制面板';
            pinPanelBtn.setAttribute('aria-pressed', 'false');
        }
    }

    function handleKeydown(event) {
        const inPlayMode = playMode.classList.contains('active');

        const isNudgeKey = event.code === 'ArrowUp' || event.code === 'ArrowDown';
        if (!isNudgeKey) {
            stopNudgeHold();
        }

        if (inPlayMode) {
            switch (event.code) {
                case 'Space':
                    event.preventDefault();
                    togglePlay();
                    return;
                case 'ArrowUp':
                    event.preventDefault();
                    startNudgeHold('up', event.repeat);
                    return;
                case 'ArrowDown':
                    event.preventDefault();
                    startNudgeHold('down', event.repeat);
                    return;
                case 'ArrowLeft':
                    event.preventDefault();
                    adjustFontSize(-2);
                    return;
                case 'ArrowRight':
                    event.preventDefault();
                    adjustFontSize(2);
                    return;
                case 'KeyR':
                    event.preventDefault();
                    resetPosition();
                    return;
                case 'Escape':
                    event.preventDefault();
                    if (isFullscreen) {
                        exitFullscreen();
                    } else {
                        exitPlayMode();
                    }
                    return;
            }

            if (event.code === 'Equal' || event.code === 'NumpadAdd' || event.key === '+') {
                event.preventDefault();
                adjustSpeed(0.1);
                return;
            }

            if (event.code === 'Minus' || event.code === 'NumpadSubtract' || event.key === '-') {
                event.preventDefault();
                adjustSpeed(-0.1);
                return;
            }
        }

        if (event.code === 'KeyF') {
            event.preventDefault();
            toggleFullscreen();
            return;
        }

        if (event.code === 'KeyH') {
            event.preventDefault();
            toggleControlPanelPin();
            return;
        }

        if (!inPlayMode && event.code === 'Escape' && isFullscreen) {
            event.preventDefault();
            exitFullscreen();
        }
    }

    function handleKeyup(event) {
        if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
            stopNudgeHold();
        }
    }

    function startNudgeHold(direction, isRepeat) {
        const delta = direction === 'up' ? -POSITION_NUDGE : POSITION_NUDGE;

        if (isRepeat) {
            nudgePosition(delta, { announce: false });
            return;
        }

        stopNudgeHold();
        nudgeHoldDirection = direction;
        nudgePosition(delta, { announce: true });

        nudgeHoldTimeout = setTimeout(() => {
            if (nudgeHoldDirection !== direction) {
                return;
            }
            nudgeHoldInterval = setInterval(() => {
                nudgePosition(delta, { announce: false });
            }, NUDGE_HOLD_INTERVAL);
        }, NUDGE_HOLD_INITIAL_DELAY);
    }

    function stopNudgeHold() {
        if (nudgeHoldTimeout) {
            clearTimeout(nudgeHoldTimeout);
            nudgeHoldTimeout = null;
        }
        if (nudgeHoldInterval) {
            clearInterval(nudgeHoldInterval);
            nudgeHoldInterval = null;
        }
        nudgeHoldDirection = null;
    }

    function togglePlay() {
        if (!playMode.classList.contains('active')) {
            if (!textInput.value.trim()) {
                alert('请先输入文本内容！');
                return;
            }
            enterPlayMode();
        }

        isPlaying = !isPlaying;

        if (isPlaying) {
            startScrolling();
            hideHeader(true);
        } else {
            stopScrolling();
            showHeader();
        }

        updateStatus();
        updatePlayButtons();
    }

    function enterPlayMode() {
        pinStateBeforePlay = controlsPinned;
        setControlPanelPinned(false);
        hideControlPanel({ immediate: true });

        editMode.classList.add('hidden');
        playMode.classList.add('active');
        document.body.classList.add('play-mode-active');

        teleprompterText.textContent = textInput.value;
        recomputeLayout();

        showHeader();
        hideHeader();
        fullscreenControls.classList.remove('edge-visible');
    }

    function exitPlayMode() {
        stopScrolling();
        stopNudgeHold();
        isPlaying = false;

        playMode.classList.remove('active');
        editMode.classList.remove('hidden');
        document.body.classList.remove('play-mode-active');

        currentPosition = 0;
        teleprompterText.style.transform = 'translateY(100%)';
        fullscreenControls.classList.remove('edge-visible');

        setControlPanelPinned(pinStateBeforePlay);
        updateStatus();
        updatePlayButtons();
        showHeader();
        hideHeader();
    }

    function updatePlayButtons() {
        playBtn.textContent = isPlaying ? '⏸️ 暂停播放' : '▶️ 开始播放';
        togglePlayFloatingBtn.textContent = isPlaying ? '⏸️ 暂停' : '▶️ 播放';
    }

    function startScrolling() {
        if (!playMode.classList.contains('active')) {
            return;
        }

        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        recomputeLayout({ preserveProgress: true });
        lastTimestamp = null;

        const scroll = (timestamp) => {
            if (!isPlaying) {
                animationId = null;
                return;
            }

            if (lastTimestamp === null) {
                lastTimestamp = timestamp;
                animationId = requestAnimationFrame(scroll);
                return;
            }

            const deltaSeconds = (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            const directionFactor = scrollDirection === 'up' ? -1 : 1;
            const distance = directionFactor * scrollSpeed * BASE_SCROLL_VELOCITY * deltaSeconds;
            currentPosition += distance;

            wrapCurrentPosition();
            teleprompterText.style.transform = `translateY(${currentPosition}px)`;

            animationId = requestAnimationFrame(scroll);
        };

        animationId = requestAnimationFrame(scroll);
    }

    function stopScrolling() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (nudgeAnimationFrame) {
            cancelAnimationFrame(nudgeAnimationFrame);
            nudgeAnimationFrame = null;
        }
        nudgeAnimationStart = null;
        lastTimestamp = null;
    }

    function resetPosition() {
        const wasPlaying = isPlaying;
        if (wasPlaying) {
            stopScrolling();
        }
        recomputeLayout();
        if (wasPlaying) {
            isPlaying = true;
            startScrolling();
        }
    }

    function recomputeLayout({ preserveProgress = false } = {}) {
        if (!playMode.classList.contains('active')) {
            return;
        }

        const previousContainerHeight = containerHeight;
        const previousTextHeight = textHeight;

        containerHeight = playMode.clientHeight;
        textHeight = teleprompterText.scrollHeight;

        if (!preserveProgress || previousContainerHeight === 0 || previousTextHeight === 0) {
            currentPosition = scrollDirection === 'up' ? containerHeight : -textHeight;
        } else {
            const previousTotal = previousContainerHeight + previousTextHeight;
            const nextTotal = containerHeight + textHeight;
            if (previousTotal > 0 && nextTotal > 0) {
                let progress;
                if (scrollDirection === 'up') {
                    progress = (previousContainerHeight - currentPosition) / previousTotal;
                } else {
                    progress = (currentPosition + previousTextHeight) / previousTotal;
                }
                progress = Math.min(1, Math.max(0, progress));
                if (scrollDirection === 'up') {
                    currentPosition = containerHeight - progress * nextTotal;
                } else {
                    currentPosition = -textHeight + progress * nextTotal;
                }
            } else {
                currentPosition = scrollDirection === 'up' ? containerHeight : -textHeight;
            }
        }

        teleprompterText.style.transform = `translateY(${currentPosition}px)`;
    }

    function wrapCurrentPosition() {
        if (scrollDirection === 'up') {
            if (currentPosition <= -textHeight) {
                currentPosition = containerHeight;
            } else if (currentPosition > containerHeight) {
                currentPosition = -textHeight;
            }
        } else {
            if (currentPosition >= containerHeight) {
                currentPosition = -textHeight;
            } else if (currentPosition < -textHeight) {
                currentPosition = containerHeight;
            }
        }
    }

    function wrapTargetPosition() {
        if (scrollDirection === 'up') {
            if (nudgeTargetPosition <= -textHeight) {
                nudgeTargetPosition = containerHeight;
            } else if (nudgeTargetPosition > containerHeight) {
                nudgeTargetPosition = -textHeight;
            }
        } else {
            if (nudgeTargetPosition >= containerHeight) {
                nudgeTargetPosition = -textHeight;
            } else if (nudgeTargetPosition < -textHeight) {
                nudgeTargetPosition = containerHeight;
            }
        }
    }

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function updateSpeed(value) {
        const numericValue = parseFloat(value);
        scrollSpeed = Number.isFinite(numericValue) ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, numericValue)) : 1;
        speedRange.value = scrollSpeed;
        speedValue.textContent = scrollSpeed.toFixed(1);
        saveSettings();
        updateStatus();
        flashStatus(`速度：${scrollSpeed.toFixed(1)}x`);
    }

    function adjustSpeed(delta) {
        updateSpeed(scrollSpeed + delta);
    }

    function updateDirection(value) {
        scrollDirection = value;
        saveSettings();
        const wasPlaying = isPlaying;
        if (wasPlaying) {
            stopScrolling();
        }
        recomputeLayout();
        if (wasPlaying) {
            isPlaying = true;
            startScrolling();
        }
        updateStatus();
    }

    function updateFontSize(value) {
        const size = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
        fontSizeRange.value = size;
        fontSizeValue.textContent = size;
        teleprompterText.style.fontSize = `${size}px`;
        textInput.style.fontSize = `${size}px`;
        saveSettings();
        if (playMode.classList.contains('active')) {
            recomputeLayout({ preserveProgress: true });
        }
        flashStatus(`字体大小：${size}px`, 1500);
    }

    function adjustFontSize(delta) {
        const currentSize = parseInt(teleprompterText.style.fontSize, 10) || 36;
        updateFontSize(currentSize + delta);
    }

    function updateFontFamily(value) {
        const selectedValue = value && value.trim() ? value : 'system-ui';
        fontFamilySelect.value = selectedValue;
        teleprompterText.style.fontFamily = selectedValue;
        textInput.style.fontFamily = selectedValue;
        if (!isApplyingSettings) {
            saveSettings();
            const label = fontFamilySelect.options[fontFamilySelect.selectedIndex]?.textContent || '字体';
            flashStatus(`字体：${label}`, 1500);
        }
    }

    function updateLineHeight(value) {
        lineHeightRange.value = value;
        lineHeightValue.textContent = Number(value).toFixed(1);
        teleprompterText.style.lineHeight = value;
        textInput.style.lineHeight = value;
        saveSettings();
        if (playMode.classList.contains('active')) {
            recomputeLayout({ preserveProgress: true });
        }
        flashStatus(`行距：${Number(value).toFixed(1)}`, 1500);
    }

    function updateFramePadding(value) {
        if (!framePaddingRange || !framePaddingValue) {
            return;
        }
        const numericValue = Math.max(0, Math.min(200, parseInt(value, 10) || 0));
        framePaddingRange.value = numericValue;
        framePaddingValue.textContent = numericValue;
        document.documentElement.style.setProperty('--frame-padding-vertical', `${numericValue}px`);
        document.documentElement.style.setProperty('--frame-padding-horizontal', `${numericValue}px`);
        if (playMode.classList.contains('active')) {
            recomputeLayout({ preserveProgress: true });
        }
        if (!isApplyingSettings) {
            saveSettings();
            flashStatus(`页面边框：${numericValue}px`, 1500);
        }
    }

    function updateAlignment(value) {
        alignmentSelect.value = value;
        applyAlignment(value);
        saveSettings();
        if (playMode.classList.contains('active')) {
            recomputeLayout({ preserveProgress: true });
        }
        if (!isApplyingSettings) {
            const labelMap = {
                left: '左对齐',
                center: '居中对齐',
                right: '右对齐',
                justify: '两端对齐'
            };
            flashStatus(`对齐方式：${labelMap[value] || value}`, 1500);
        }
    }

    function applyAlignment(value) {
        teleprompterText.style.textAlign = value;
        textInput.style.textAlign = value;
    }

    function updateTextColor(value) {
        teleprompterText.style.color = value;
        saveSettings();
    }

    function updateBgColor(value) {
        playMode.style.backgroundColor = value;
        saveSettings();
    }

    function nudgePosition(delta, { announce = false } = {}) {
        if (!playMode.classList.contains('active')) {
            return;
        }

        if (containerHeight === 0 || textHeight === 0) {
            recomputeLayout({ preserveProgress: true });
        }

        if (nudgeAnimationFrame) {
            cancelAnimationFrame(nudgeAnimationFrame);
            nudgeAnimationFrame = null;
        }

        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
            lastTimestamp = null;
        }

        nudgeStartPosition = currentPosition;
        nudgeTargetPosition = currentPosition + delta;
        wrapTargetPosition();
        nudgeAnimationStart = null;

        if (announce) {
            const directionLabel = delta < 0 ? '向上移动' : '向下移动';
            flashStatus(`${directionLabel} ${Math.abs(delta)}px`, 900);
        }

        const animate = (timestamp) => {
            if (nudgeAnimationStart === null) {
                nudgeAnimationStart = timestamp;
            }
            const elapsed = timestamp - nudgeAnimationStart;
            const progress = Math.min(1, elapsed / NUDGE_ANIMATION_DURATION);
            const eased = easeInOutCubic(progress);
            currentPosition = nudgeStartPosition + (nudgeTargetPosition - nudgeStartPosition) * eased;
            wrapCurrentPosition();
            teleprompterText.style.transform = `translateY(${currentPosition}px)`;
            if (progress < 1) {
                nudgeAnimationFrame = requestAnimationFrame(animate);
            } else {
                nudgeAnimationFrame = null;
                if (isPlaying) {
                    startScrolling();
                }
            }
        };

        nudgeAnimationFrame = requestAnimationFrame(animate);
    }

    function updateStatus(extraMessage) {
        if (statusMessageTimer) {
            clearTimeout(statusMessageTimer);
            statusMessageTimer = null;
        }
        baseStatusMessage = extraMessage || '';
        if (baseStatusMessage) {
            setStatusMessage(baseStatusMessage);
        } else {
            hideStatusBar(true);
        }
    }

    function saveText() {
        localStorage.setItem('teleprompter_text', textInput.value);
    }

    function loadText() {
        const savedText = localStorage.getItem('teleprompter_text');
        if (savedText) {
            textInput.value = savedText;
        }
    }

    function saveSettings() {
        if (isApplyingSettings) {
            return;
        }
        const settings = {
            speed: scrollSpeed,
            direction: scrollDirection,
            fontSize: teleprompterText.style.fontSize || '36px',
            textColor: teleprompterText.style.color || '#ffffff',
            bgColor: playMode.style.backgroundColor || '#000000',
            lineHeight: teleprompterText.style.lineHeight || '1.8',
            alignment: alignmentSelect.value || 'center',
            framePadding: parseInt(framePaddingRange.value, 10) || 0,
            fontFamily: fontFamilySelect.value || 'system-ui'
        };
        localStorage.setItem('teleprompter_settings', JSON.stringify(settings));
    }

    function loadSettings() {
        const savedSettings = localStorage.getItem('teleprompter_settings');
        isApplyingSettings = true;
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);

                scrollSpeed = typeof settings.speed === 'number' ? settings.speed : parseFloat(settings.speed) || 1;
                scrollSpeed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, scrollSpeed));
                scrollDirection = settings.direction || 'up';
                speedRange.value = scrollSpeed;
                speedValue.textContent = scrollSpeed.toFixed(1);
                directionSelect.value = scrollDirection;

                if (settings.fontSize) {
                    const fontSize = parseInt(settings.fontSize, 10);
                    teleprompterText.style.fontSize = settings.fontSize;
                    textInput.style.fontSize = settings.fontSize;
                    fontSizeRange.value = fontSize;
                    fontSizeValue.textContent = fontSize;
                }

                if (settings.textColor) {
                    teleprompterText.style.color = settings.textColor;
                    textColorPicker.value = settings.textColor;
                }

                if (settings.bgColor) {
                    playMode.style.backgroundColor = settings.bgColor;
                    bgColorPicker.value = settings.bgColor;
                }

                if (settings.lineHeight) {
                    teleprompterText.style.lineHeight = settings.lineHeight;
                    textInput.style.lineHeight = settings.lineHeight;
                    lineHeightRange.value = parseFloat(settings.lineHeight);
                    lineHeightValue.textContent = parseFloat(settings.lineHeight).toFixed(1);
                }

                if (typeof settings.framePadding === 'number') {
                    updateFramePadding(settings.framePadding);
                } else if (typeof settings.framePadding === 'string' && settings.framePadding.trim() !== '') {
                    updateFramePadding(parseInt(settings.framePadding, 10));
                }

                const alignment = settings.alignment || 'center';
                alignmentSelect.value = alignment;
                applyAlignment(alignment);
                if (settings.fontFamily) {
                    updateFontFamily(settings.fontFamily);
                }
            } catch (error) {
                console.error('无法载入设置:', error);
            }
        } else {
            applyAlignment(alignmentSelect.value || 'center');
            speedValue.textContent = scrollSpeed.toFixed(1);
            updateFramePadding(parseInt(framePaddingRange.value, 10));
            updateFontFamily(fontFamilySelect.value || 'system-ui');
        }
        isApplyingSettings = false;
    }

    function exportText() {
        const text = textInput.value;
        if (!text.trim()) {
            alert('没有可导出的文本内容！');
            return;
        }
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `提词器文本_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    function clearText() {
        if (confirm('确定要清空当前文本吗？此操作不可撤销。')) {
            textInput.value = '';
            saveText();
            if (playMode.classList.contains('active')) {
                teleprompterText.textContent = '';
                recomputeLayout();
            }
        }
    }

    function handleFileUpload(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }
        if (file.type && file.type !== 'text/plain') {
            alert('请选择有效的文本文件（.txt）。');
            fileInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            textInput.value = e.target.result;
            saveText();
            if (playMode.classList.contains('active')) {
                teleprompterText.textContent = textInput.value;
                recomputeLayout({ preserveProgress: true });
            }
        };
        reader.readAsText(file, 'UTF-8');
        fileInput.value = '';
    }

    function toggleFullscreen() {
        if (isFullscreen) {
            exitFullscreen();
        } else {
            enterFullscreen();
        }
    }

    function enterFullscreen() {
        pinStateBeforeFullscreen = controlsPinned;
        controlsVisibleBeforeFullscreen = controlsVisible;

        setControlPanelPinned(false);
        hideControlPanel({ immediate: true });
        hideHeader(true);
        hideStatusBar(true);
        fullscreenControls.classList.remove('edge-visible');

        const element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    function exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    function handleFullscreenChange() {
        isFullscreen = !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);

        if (isFullscreen) {
            hideHeader(true);
            hideStatusBar(true);
        } else {
            controlsPinned = pinStateBeforeFullscreen;
            updatePanelPinButton();
            if (controlsPinned || controlsVisibleBeforeFullscreen) {
                showControlPanel({ immediate: true });
            } else {
                hideControlPanel({ immediate: true });
            }
            if (controlsPinned) {
                document.body.classList.add('panel-pinned');
            }
        }

        if (playMode.classList.contains('active')) {
            recomputeLayout({ preserveProgress: true });
        }
    }
})();