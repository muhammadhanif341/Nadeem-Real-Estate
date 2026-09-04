(function () {
  'use strict';

  var toggleBtn = document.getElementById('chatToggleBtn');
  var closeBtn = document.getElementById('chatCloseBtn');
  var chatWindow = document.getElementById('chatWindow');
  var chatForm = document.getElementById('chatForm');
  var chatInput = document.getElementById('chatInput');
  var chatMessages = document.getElementById('chatMessages');

  var MOCK_REPLY = "Hi! I'm Muhammad Nadeem. My AI brain isn't connected yet.";
  var REPLY_DELAY_MS = 600;
  var CLOSE_TRANSITION_MS = 220;

  function isOpen() {
    return chatWindow.classList.contains('chat-window--open');
  }

  function openChat() {
    chatWindow.hidden = false;
    requestAnimationFrame(function () {
      chatWindow.classList.add('chat-window--open');
    });
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.setAttribute('aria-label', 'Close chat');
    chatInput.focus();
  }

  function closeChat() {
    chatWindow.classList.remove('chat-window--open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-label', 'Open chat');
    window.setTimeout(function () {
      if (!isOpen()) {
        chatWindow.hidden = true;
      }
    }, CLOSE_TRANSITION_MS);
  }

  function addMessage(text, sender) {
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble--' + sender;
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  toggleBtn.addEventListener('click', function () {
    if (isOpen()) {
      closeChat();
    } else {
      openChat();
    }
  });

  closeBtn.addEventListener('click', closeChat);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen()) {
      closeChat();
      toggleBtn.focus();
    }
  });

  chatForm.addEventListener('submit', function (event) {
    event.preventDefault();

    var text = chatInput.value.trim();
    if (!text) {
      return;
    }

    addMessage(text, 'user');
    chatInput.value = '';
    chatInput.focus();

    window.setTimeout(function () {
      addMessage(MOCK_REPLY, 'bot');
    }, REPLY_DELAY_MS);
  });
})();
