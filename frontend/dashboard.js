(function () {
  "use strict";

  var loadingEl = document.getElementById("dashboardLoading");
  var errorEl = document.getElementById("dashboardError");
  var emptyEl = document.getElementById("dashboardEmpty");
  var tableWrapEl = document.getElementById("dashboardTableWrap");
  var tableBodyEl = document.getElementById("dashboardTableBody");
  var retryBtn = document.getElementById("dashboardRetryBtn");

  // Mirrors the backend's transition rules (server.js) for the dropdown's
  // options only — the backend independently validates every change, this
  // just avoids offering a change the server would reject anyway.
  var STATUS_TRANSITIONS = {
    NEW: ["CONTACTED", "CANCELLED"],
    CONTACTED: ["VIEWING_SCHEDULED", "CANCELLED"],
    VIEWING_SCHEDULED: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  function setState(state) {
    loadingEl.hidden = state !== "loading";
    errorEl.hidden = state !== "error";
    emptyEl.hidden = state !== "empty";
    tableWrapEl.hidden = state !== "table";
  }

  function textOrDash(value) {
    return value === null || value === undefined || value === "" ? "—" : value;
  }

  function formatTimestamp(iso) {
    if (!iso) return "—";
    var date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleString();
  }

  function formatFee(fee) {
    if (!fee || typeof fee.finalFee !== "number") return "—";
    if (!fee.baseFee && !fee.tax && !fee.discount && !fee.finalFee) {
      return "No applicable fee";
    }
    return fee.finalFee.toFixed(2) + " " + (fee.currency || "");
  }

  function buildStatusCell(inquiry) {
    var wrap = document.createElement("div");

    var badge = document.createElement("span");
    badge.className = "status-badge status-badge--" + inquiry.status;
    badge.textContent = inquiry.status;
    wrap.appendChild(badge);

    var select = document.createElement("select");
    select.className = "status-select";
    select.setAttribute("aria-label", "Change status for inquiry " + inquiry.inquiryId);

    var currentOption = document.createElement("option");
    currentOption.value = inquiry.status;
    currentOption.textContent = inquiry.status + " (current)";
    select.appendChild(currentOption);

    var nextOptions = STATUS_TRANSITIONS[inquiry.status] || [];
    nextOptions.forEach(function (statusValue) {
      var option = document.createElement("option");
      option.value = statusValue;
      option.textContent = statusValue;
      select.appendChild(option);
    });

    if (nextOptions.length === 0) {
      select.disabled = true;
    }

    var errorText = document.createElement("p");
    errorText.className = "status-error";
    errorText.hidden = true;

    select.addEventListener("change", function () {
      var newStatus = select.value;
      if (newStatus === inquiry.status) return;

      select.disabled = true;
      errorText.hidden = true;

      updateInquiryStatus(inquiry.inquiryId, newStatus)
        .then(function (updatedInquiry) {
          inquiry.status = updatedInquiry.status;
          renderTable(currentInquiries);
        })
        .catch(function (err) {
          select.value = inquiry.status;
          select.disabled = nextOptions.length === 0;
          errorText.textContent = err.message || "Could not update status.";
          errorText.hidden = false;
        });
    });

    wrap.appendChild(select);
    wrap.appendChild(errorText);
    return wrap;
  }

  function textCell(text, className) {
    var td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = textOrDash(text);
    return td;
  }

  function propertyCell(inquiry) {
    var td = document.createElement("td");

    var nameLine = document.createElement("div");
    nameLine.textContent = inquiry.propertyName ? inquiry.propertyName : "Unknown property";
    td.appendChild(nameLine);

    var idLine = document.createElement("span");
    idLine.className = "cell-muted cell-mono";
    idLine.textContent = textOrDash(inquiry.propertyId);
    td.appendChild(idLine);

    return td;
  }

  function renderRow(inquiry) {
    var tr = document.createElement("tr");

    tr.appendChild(textCell(inquiry.inquiryId, "cell-mono"));
    tr.appendChild(propertyCell(inquiry));
    tr.appendChild(textCell(inquiry.inquiryType));
    tr.appendChild(textCell(inquiry.preferredDate));
    tr.appendChild(textCell(inquiry.preferredTime));
    tr.appendChild(textCell(inquiry.customerDetails && inquiry.customerDetails.name));
    tr.appendChild(textCell(inquiry.customerDetails && inquiry.customerDetails.phone));
    tr.appendChild(textCell(inquiry.message));
    tr.appendChild(textCell(inquiry.promotionId));
    tr.appendChild(textCell(formatFee(inquiry.fee)));
    tr.appendChild(textCell(formatTimestamp(inquiry.timestamp)));

    var statusTd = document.createElement("td");
    statusTd.appendChild(buildStatusCell(inquiry));
    tr.appendChild(statusTd);

    return tr;
  }

  var currentInquiries = [];

  function renderTable(inquiries) {
    currentInquiries = inquiries;
    tableBodyEl.innerHTML = "";
    inquiries.forEach(function (inquiry) {
      tableBodyEl.appendChild(renderRow(inquiry));
    });
  }

  function fetchInquiries() {
    setState("loading");
    return fetch("/api/inquiries")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load inquiries.");
        return res.json();
      })
      .then(function (data) {
        var inquiries = (data && data.inquiries) || [];
        if (inquiries.length === 0) {
          setState("empty");
          return;
        }
        renderTable(inquiries);
        setState("table");
      })
      .catch(function () {
        setState("error");
      });
  }

  function updateInquiryStatus(inquiryId, status) {
    return fetch("/api/inquiries/" + encodeURIComponent(inquiryId) + "/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error((data && data.error) || "Could not update status.");
          return data.inquiry;
        });
      });
  }

  retryBtn.addEventListener("click", fetchInquiries);

  fetchInquiries();
})();
