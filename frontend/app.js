(function () {
  'use strict';

  var toggleBtn = document.getElementById('chatToggleBtn');
  var closeBtn = document.getElementById('chatCloseBtn');
  var chatWindow = document.getElementById('chatWindow');
  var chatForm = document.getElementById('chatForm');
  var chatInput = document.getElementById('chatInput');
  var chatMessages = document.getElementById('chatMessages');
  var chatSendBtn = chatForm.querySelector('button[type="submit"]');

  var ERROR_REPLY = "Sorry, something went wrong. Please try again in a moment.";
  var CLOSE_TRANSITION_MS = 220;
  var CHAT_API_URL = '/api/chat';

  var conversationHistory = [];

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
    return bubble;
  }

  function showTypingIndicator() {
    var bubble = addMessage('Typing…', 'bot');
    bubble.classList.add('chat-bubble--typing');
    return bubble;
  }

  function removeTypingIndicator(bubble) {
    if (bubble && bubble.parentNode) {
      bubble.parentNode.removeChild(bubble);
    }
  }

  toggleBtn.addEventListener('click', function () {
    if (isOpen()) {
      closeChat();
    } else {
      openChat();
    }
  });

  closeBtn.addEventListener('click', closeChat);

  document.querySelectorAll('.js-inquire-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var propertyId = btn.getAttribute('data-property-id');
      var propertyName = btn.getAttribute('data-property-name');
      openChat();
      if (propertyId && propertyName) {
        chatInput.value = "I'm interested in the " + propertyName + " (" + propertyId + ").";
      }
      chatInput.focus();
    });
  });

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

    var historyForRequest = conversationHistory.slice();

    addMessage(text, 'user');
    conversationHistory.push({ role: 'user', content: text });
    chatInput.value = '';
    chatInput.disabled = true;
    chatSendBtn.disabled = true;

    var typingBubble = showTypingIndicator();

    fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        conversationHistory: historyForRequest,
      }),
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Chat request failed with status ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        removeTypingIndicator(typingBubble);
        var reply = data && data.reply;
        if (!reply) {
          throw new Error('Chat response missing reply');
        }
        addMessage(reply, 'bot');
        conversationHistory.push({ role: 'assistant', content: reply });
      })
      .catch(function () {
        removeTypingIndicator(typingBubble);
        addMessage(ERROR_REPLY, 'bot');
      })
      .finally(function () {
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatInput.focus();
      });
  });
})();
