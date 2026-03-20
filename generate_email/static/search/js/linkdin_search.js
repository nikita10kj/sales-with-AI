document.addEventListener("DOMContentLoaded", function () {

    // ── Toast ──
    const customMessage = document.getElementById("customMessage");
    const customMessageText = document.getElementById("customMessageText");
    const closeCustomMessage = document.getElementById("closeCustomMessage");
    let customMessageTimeout;

    function showMessage(message, type = "success") {
        if (!customMessage || !customMessageText) return;
        customMessageText.textContent = message;
        customMessage.classList.remove("custom-message-success", "custom-message-error");
        customMessage.classList.add(type === "error" ? "custom-message-error" : "custom-message-success");
        customMessage.style.display = "block";
        clearTimeout(customMessageTimeout);
        customMessageTimeout = setTimeout(function () {
            customMessage.style.display = "none";
        }, 4000);
    }

    if (closeCustomMessage) {
        closeCustomMessage.addEventListener("click", function () {
            customMessage.style.display = "none";
            clearTimeout(customMessageTimeout);
        });
    }

    // ── Enrich loader ──
    const loader = document.getElementById("enrichLoader");

    // ── Show loader on form submit ──
    const searchForm = document.getElementById("linkedinSearchForm");
    if (searchForm) {
        searchForm.addEventListener("submit", function () {
            if (loader) loader.style.display = "flex";
        });
    }

    // ── Utility ──
    function escapeHtml(value) {
        if (value === null || value === undefined) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + "=")) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // ── Selection UI ──
    const rowCheckboxes = document.querySelectorAll(".row-checkbox");
    const selectAllRows = document.getElementById("selectAllRows");
    const selectedCountText = document.getElementById("selectedCountText");
    const saveToListBtn = document.getElementById("saveToListBtn");

    const saveListModal = document.getElementById("saveListModal");
    const closeSaveListModal = document.getElementById("closeSaveListModal");
    const cancelSaveListBtn = document.getElementById("cancelSaveListBtn");
    const confirmSaveListBtn = document.getElementById("confirmSaveListBtn");

    const newListTab = document.getElementById("newListTab");
    const existingListTab = document.getElementById("existingListTab");
    const newListSection = document.getElementById("newListSection");
    const existingListSection = document.getElementById("existingListSection");
    const newListName = document.getElementById("newListName");
    const existingListSelect = document.getElementById("existingListSelect");

    let activeListMode = "new";

    function updateSelectionUI() {
        if (!selectedCountText || !saveToListBtn) return;
        const checkedCount = document.querySelectorAll(".row-checkbox:checked").length;
        const totalCount = rowCheckboxes.length;
        selectedCountText.textContent = `${checkedCount} selected of ${totalCount} results`;
        saveToListBtn.style.display = checkedCount > 0 ? "inline-flex" : "none";
        if (selectAllRows) {
            selectAllRows.checked = totalCount > 0 && checkedCount === totalCount;
        }
    }

    function collectSelectedPeople() {
        const selected = [];
        document.querySelectorAll(".row-checkbox:checked").forEach(function (cb) {
            selected.push({
                first:               cb.getAttribute("data-first") || "",
                last:                cb.getAttribute("data-last") || "",
                linkedin:            cb.getAttribute("data-linkedin") || "",
                company:             cb.getAttribute("data-company") || "",
                company_website:     cb.getAttribute("data-company_website") || "",
                job_title:           cb.getAttribute("data-job_title") || "",
                institution:         cb.getAttribute("data-institution") || "",
                location:            cb.getAttribute("data-location") || "",
                company_headquarter: cb.getAttribute("data-company_headquarter") || "",
                email:               cb.getAttribute("data-email") || "",
                phone:               cb.getAttribute("data-phone") || ""
            });
        });
        return selected;
    }

    async function loadExistingLists() {
        if (!existingListSelect) return;
        try {
            const response = await fetch(GET_SAVED_LISTS_URL, {
                method: "GET",
                headers: { "X-Requested-With": "XMLHttpRequest" }
            });
            const data = await response.json();
            existingListSelect.innerHTML = '<option value="">Select a list</option>';
            if (data.success && Array.isArray(data.lists)) {
                data.lists.forEach(function (item) {
                    const option = document.createElement("option");
                    option.value = item.id;
                    option.textContent = item.name;
                    existingListSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Failed to load existing lists:", error);
        }
    }

    function openModal() {
        if (saveListModal) saveListModal.style.display = "flex";
    }

    function closeModal() {
        if (saveListModal) saveListModal.style.display = "none";
        if (newListName) newListName.value = "";
        if (existingListSelect) existingListSelect.value = "";
    }

    function setTab(mode) {
        activeListMode = mode;
        if (!newListSection || !existingListSection || !newListTab || !existingListTab) return;
        if (mode === "new") {
            newListSection.style.display = "block";
            existingListSection.style.display = "none";
            newListTab.style.background = "#2f6df0";
            newListTab.style.color = "#fff";
            existingListTab.style.background = "#eef0f4";
            existingListTab.style.color = "#2e374d";
        } else {
            newListSection.style.display = "none";
            existingListSection.style.display = "block";
            existingListTab.style.background = "#2f6df0";
            existingListTab.style.color = "#fff";
            newListTab.style.background = "#eef0f4";
            newListTab.style.color = "#2e374d";
        }
    }

    if (selectAllRows) {
        selectAllRows.addEventListener("change", function () {
            rowCheckboxes.forEach(function (cb) { cb.checked = selectAllRows.checked; });
            updateSelectionUI();
        });
    }

    rowCheckboxes.forEach(function (cb) {
        cb.addEventListener("change", updateSelectionUI);
    });

    if (saveToListBtn) {
        saveToListBtn.addEventListener("click", async function () {
            await loadExistingLists();
            setTab("new");
            openModal();
        });
    }

    if (closeSaveListModal) closeSaveListModal.addEventListener("click", closeModal);
    if (cancelSaveListBtn) cancelSaveListBtn.addEventListener("click", closeModal);

    if (newListTab) newListTab.addEventListener("click", function () { setTab("new"); });
    if (existingListTab) {
        existingListTab.addEventListener("click", async function () {
            setTab("existing");
            await loadExistingLists();
        });
    }

    if (confirmSaveListBtn) {
        confirmSaveListBtn.addEventListener("click", async function () {
            const selectedPeople = collectSelectedPeople();
            if (!selectedPeople.length) {
                showMessage("Please select at least one person.", "error");
                return;
            }

            const payload = { list_type: activeListMode, people: selectedPeople };

            if (activeListMode === "new") {
                const listName = newListName ? newListName.value.trim() : "";
                if (!listName) { showMessage("Please enter a list name.", "error"); return; }
                payload.list_name = listName;
            } else {
                const listId = existingListSelect ? existingListSelect.value : "";
                if (!listId) { showMessage("Please select an existing list.", "error"); return; }
                payload.list_id = listId;
            }

            try {
                confirmSaveListBtn.disabled = true;
                confirmSaveListBtn.textContent = "Saving...";

                const response = await fetch(SAVE_PEOPLE_TO_LIST_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (!data.success) {
                    showMessage(data.error || "Could not save list.", "error");
                    return;
                }
                showMessage(data.message || "Saved successfully.", "success");
                closeModal();
            } catch (error) {
                console.error("Save list error:", error);
                showMessage("Server error while saving list.", "error");
            } finally {
                confirmSaveListBtn.disabled = false;
                confirmSaveListBtn.textContent = "Save to List";
            }
        });
    }

    // ── Single row Save to List button ──
    document.addEventListener("click", function (e) {
        const singleSaveBtn = e.target.closest(".single-save-btn");
        if (singleSaveBtn) {
            document.querySelectorAll(".row-checkbox").forEach(cb => cb.checked = false);
            const selectAll = document.getElementById("selectAllRows");
            if (selectAll) selectAll.checked = false;

            const row = singleSaveBtn.closest("tr");
            if (row) {
                const cb = row.querySelector(".row-checkbox");
                if (cb) cb.checked = true;
            }

            updateSelectionUI();
            const listBtn = document.getElementById("saveToListBtn");
            if (listBtn) listBtn.click();
        }
    });

    // ── Enrich (email/phone fetch) events ──
    function attachEnrichEvents() {

        function getFirstEmail(person) {
            if (!person.emails || !person.emails.length) return "";
            return typeof person.emails[0] === "string"
                ? person.emails[0]
                : (person.emails[0].email || "");
        }

        function getFirstPhone(person) {
            if (!person.phones || !person.phones.length) return "";
            return typeof person.phones[0] === "string"
                ? person.phones[0]
                : (person.phones[0].number || "");
        }

        function getRowData(cardRow) {
            if (!cardRow) return {};
            const cb = cardRow.querySelector(".row-checkbox");
            if (!cb) return {};
            return {
                first:               cb.getAttribute("data-first") || "",
                last:                cb.getAttribute("data-last") || "",
                linkedin:            cb.getAttribute("data-linkedin") || "",
                company:             cb.getAttribute("data-company") || "",
                company_website:     cb.getAttribute("data-company_website") || "",
                job_title:           cb.getAttribute("data-job_title") || "",
                institution:         cb.getAttribute("data-institution") || "",
                location:            cb.getAttribute("data-location") || "",
                company_headquarter: cb.getAttribute("data-company_headquarter") || "",
                email:               cb.getAttribute("data-email") || "",
                phone:               cb.getAttribute("data-phone") || ""
            };
        }

        function buildSendEmailForm(person, csrfToken) {
            if (!person.email) {
                return `<button type="button" class="send-email-action-btn" disabled><i class="far fa-envelope"></i> Send Email</button>`;
            }
            return `
                <form method="POST" action="${SELECT_PERSON_FOR_EMAIL_URL}" class="d-inline">
                    <input type="hidden" name="csrfmiddlewaretoken" value="${escapeHtml(csrfToken)}">
                    <input type="hidden" name="first" value="${escapeHtml(person.first || "")}">
                    <input type="hidden" name="last" value="${escapeHtml(person.last || "")}">
                    <input type="hidden" name="linkedin" value="${escapeHtml(person.linkedin || "")}">
                    <input type="hidden" name="company" value="${escapeHtml(person.company || "")}">
                    <input type="hidden" name="company_website" value="${escapeHtml(person.company_website || "")}">
                    <input type="hidden" name="job_title" value="${escapeHtml(person.job_title || "")}">
                    <input type="hidden" name="institution" value="${escapeHtml(person.institution || "")}">
                    <input type="hidden" name="location" value="${escapeHtml(person.location || "")}">
                    <input type="hidden" name="company_headquarter" value="${escapeHtml(person.company_headquarter || "")}">
                    <input type="hidden" name="email" value="${escapeHtml(person.email || "")}">
                    <button type="submit" class="send-email-action-btn"><i class="far fa-envelope"></i> Send Email</button>
                </form>
            `;
        }

        function renderExtraRow(cardRow, extraRow, csrfToken) {
            if (!cardRow || !extraRow) return;
            const person = getRowData(cardRow);

            let contactHtml = "";

            if (person.email) {
                contactHtml += `
                    <div>
                        <div style="font-weight:700; color:#20263d; margin-bottom:8px;">Email</div>
                        <div style="padding:12px 14px; background:#fff; border:1px solid #dfe4ee; border-radius:12px; color:#44506a;">
                            ${escapeHtml(person.email)}
                        </div>
                    </div>
                `;
            }

            if (person.phone) {
                contactHtml += `
                    <div>
                        <div style="font-weight:700; color:#20263d; margin-bottom:8px;">Phone</div>
                        <div style="padding:12px 14px; background:#fff; border:1px solid #dfe4ee; border-radius:12px; color:#44506a;">
                            ${escapeHtml(person.phone)}
                        </div>
                    </div>
                `;
            }

            if (!person.email && !person.phone) {
                contactHtml = `
                    <div>
                        <div style="padding:12px 14px; background:#fff; border:1px solid #dfe4ee; border-radius:12px; color:#44506a;">
                            No contact information found
                        </div>
                    </div>
                `;
            }

            extraRow.innerHTML = `
                <td colspan="9" style="background:#fafbfe; padding:0;">
                    <div style="padding:16px 18px;">
                        <div style="display:grid; grid-template-columns: 1fr auto; gap:16px; align-items:start;">
                            <div style="display:grid; gap:14px;">
                                ${contactHtml}
                            </div>
                            <div style="display:flex; align-items:flex-end; height:100%;">
                                ${buildSendEmailForm(person, csrfToken)}
                            </div>
                        </div>
                    </div>
                </td>
            `;

            extraRow.style.display = "table-row";
        }

        document.querySelectorAll(".enrich-form").forEach(function (form) {
            form.addEventListener("submit", async function (e) {
                e.preventDefault();

                const formData = new FormData(form);
                const csrfTokenInput = form.querySelector("[name=csrfmiddlewaretoken]");
                const csrfToken = csrfTokenInput ? csrfTokenInput.value : "";
                const cardId = formData.get("card_id");
                const enrichType = formData.get("enrich_type") || "email";

                const cardRow = document.getElementById(`person-card-${cardId}`);
                const extraRow = document.getElementById(`person-extra-${cardId}`);

                if (!cardRow || !extraRow) return;

                const rowCheckbox = cardRow.querySelector(".row-checkbox");
                const existingEmail = rowCheckbox ? (rowCheckbox.getAttribute("data-email") || "") : "";
                const existingPhone = rowCheckbox ? (rowCheckbox.getAttribute("data-phone") || "") : "";

                if ((enrichType === "email" && existingEmail) || (enrichType === "phone" && existingPhone)) {
                    renderExtraRow(cardRow, extraRow, csrfToken);
                    return;
                }

                if (loader) loader.style.display = "flex";

                try {
                    const response = await fetch(form.action || ENRICH_PERSON_URL, {
                        method: "POST",
                        headers: {
                            "X-CSRFToken": csrfToken,
                            "X-Requested-With": "XMLHttpRequest"
                        },
                        body: formData
                    });

                    const data = await response.json();
                    if (loader) loader.style.display = "none";

                    if (!data.success) {
                        showMessage(data.error || "Something went wrong.", "error");
                        return;
                    }

                    const person = data.person || {};
                    const firstEmail = getFirstEmail(person);
                    const firstPhone = getFirstPhone(person);

                    if (rowCheckbox) {
                        rowCheckbox.setAttribute("data-first", person.first || "");
                        rowCheckbox.setAttribute("data-last", person.last || "");
                        rowCheckbox.setAttribute("data-linkedin", person.linkedin || "");
                        rowCheckbox.setAttribute("data-company", person.company || "");
                        rowCheckbox.setAttribute("data-company_website", person.company_website || "");
                        rowCheckbox.setAttribute("data-job_title", person.job_title || "");
                        rowCheckbox.setAttribute("data-institution", person.institution || "");
                        rowCheckbox.setAttribute("data-location", person.location || "");
                        rowCheckbox.setAttribute("data-company_headquarter", person.company_headquarter || "");
                        // ── Preserve existing contact if API returns empty ──
                        rowCheckbox.setAttribute("data-email", firstEmail || existingEmail);
                        rowCheckbox.setAttribute("data-phone", firstPhone || existingPhone);
                    }

                    renderExtraRow(cardRow, extraRow, csrfToken);
                } catch (error) {
                    if (loader) loader.style.display = "none";
                    showMessage("Server error. Please try again.", "error");
                    console.error(error);
                }
            });
        });
    }

    // ── Global Tooltip ──
    const tooltipEl = document.createElement("div");
    tooltipEl.className = "global-custom-tooltip";
    document.body.appendChild(tooltipEl);

    document.addEventListener("mouseover", function (e) {
        const target = e.target.closest("[data-tooltip]");
        if (!target) return;
        const text = target.getAttribute("data-tooltip");
        if (!text) return;
        tooltipEl.textContent = text;
        tooltipEl.classList.add("visible");
        const rect = target.getBoundingClientRect();
        let top = rect.bottom + window.scrollY + 6;
        let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipEl.offsetWidth / 2);
        if (left < 10) left = 10;
        if (left + tooltipEl.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltipEl.offsetWidth - 10;
        }
        tooltipEl.style.top = top + "px";
        tooltipEl.style.left = left + "px";
    });

    document.addEventListener("mouseout", function (e) {
        if (e.target.closest("[data-tooltip]")) {
            tooltipEl.classList.remove("visible");
        }
    });

    window.addEventListener("scroll", () => tooltipEl.classList.remove("visible"));


    document.addEventListener("click", function (e) {
        const singleSaveBtn = e.target.closest(".single-save-btn");
        if (singleSaveBtn) {
            // Uncheck all first
            document.querySelectorAll(".row-checkbox").forEach(cb => cb.checked = false);
            const selectAll = document.getElementById("selectAllRows");
            if (selectAll) selectAll.checked = false;

            // Check only this row
            const row = singleSaveBtn.closest("tr");
            if (row) {
                const cb = row.querySelector(".row-checkbox");
                if (cb) cb.checked = true;
            }

            // Update UI & trigger modal
            updateSelectionUI();
            const saveToListBtn = document.getElementById("saveToListBtn");
            if (saveToListBtn) saveToListBtn.click();
        }
    });

    window.addEventListener("scroll", () => tooltipEl.classList.remove("visible"));

    // ── Mobile Filter Toggle ──
    const mobileFilterBtn = document.getElementById("mobileFilterBtn");
    const filtersPanel = document.querySelector(".filters-panel");
    const overlay = document.createElement("div");
    overlay.className = "mobile-filter-overlay";
    document.body.appendChild(overlay);

    if (mobileFilterBtn && filtersPanel) {
        mobileFilterBtn.addEventListener("click", function() {
            const isExpanded = filtersPanel.classList.contains("show");
            
            if (isExpanded) {
                filtersPanel.classList.remove("show");
                overlay.classList.remove("show");
                mobileFilterBtn.classList.remove("active");
                document.body.style.overflow = "";
            } else {
                filtersPanel.classList.add("show");
                overlay.classList.add("show");
                mobileFilterBtn.classList.add("active");
                document.body.style.overflow = "hidden";
            }
        });

        overlay.addEventListener("click", function() {
            filtersPanel.classList.remove("show");
            overlay.classList.remove("show");
            mobileFilterBtn.classList.remove("active");
            document.body.style.overflow = "";
        });
    }

    // ══════════════════════════════════════
    //  PROFILE DRAWER
    // ══════════════════════════════════════
    (function initProfileDrawer() {
        const drawer = document.getElementById("profileDrawer");
        const overlay = document.getElementById("profileDrawerOverlay");
        const closeBtn = document.getElementById("closeProfileDrawer");
        const saveBtn = document.getElementById("drawerSaveToListBtn");
        const drawerContent = document.getElementById("profileDrawerContent");

        if (!drawer || !overlay || !drawerContent) return;

        let currentPersonIdx = null;  // track which row is open

        function openDrawer() {
            overlay.classList.add("active");
            drawer.classList.add("open");
            document.body.style.overflow = "hidden";
        }

        function closeDrawer() {
            overlay.classList.remove("active");
            drawer.classList.remove("open");
            document.body.style.overflow = "";
            currentPersonIdx = null;
            if (saveBtn) saveBtn.classList.remove("saved");
        }

        if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
        overlay.addEventListener("click", closeDrawer);
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeDrawer();
        });

        // Drawer save-to-list button
        if (saveBtn) {
            saveBtn.addEventListener("click", async function () {
                if (currentPersonIdx === null) return;

                // Uncheck all rows, then check only this person
                document.querySelectorAll(".row-checkbox").forEach(cb => cb.checked = false);
                const selectAll = document.getElementById("selectAllRows");
                if (selectAll) selectAll.checked = false;

                const row = document.getElementById("person-card-" + currentPersonIdx);
                if (row) {
                    const cb = row.querySelector(".row-checkbox");
                    if (cb) cb.checked = true;
                }

                updateSelectionUI();
                await loadExistingLists();
                setTab("new");
                openModal();
            });
        }

        // ── Drawer "Save to Unlock" → enrich email ──
        drawerContent.addEventListener("click", async function (e) {
            const unlockBtn = e.target.closest(".drawer-unlock-link");
            if (!unlockBtn) return;
            if (currentPersonIdx === null) return;

            // Get person data from the row checkbox
            const row = document.getElementById("person-card-" + currentPersonIdx);
            if (!row) return;
            const cb = row.querySelector(".row-checkbox");
            if (!cb) return;

            // Loading state
            const origText = unlockBtn.textContent;
            unlockBtn.textContent = "Fetching…";
            unlockBtn.disabled = true;

            const formData = new FormData();
            formData.append("csrfmiddlewaretoken", getCookie("csrftoken"));
            formData.append("linkedin_url",         cb.getAttribute("data-linkedin")           || "");
            formData.append("first",                cb.getAttribute("data-first")              || "");
            formData.append("last",                 cb.getAttribute("data-last")               || "");
            formData.append("company",              cb.getAttribute("data-company")            || "");
            formData.append("company_website",      cb.getAttribute("data-company_website")    || "");
            formData.append("job_title",            cb.getAttribute("data-job_title")          || "");
            formData.append("institution",          cb.getAttribute("data-institution")        || "");
            formData.append("location",             cb.getAttribute("data-location")           || "");
            formData.append("company_headquarter",  cb.getAttribute("data-company_headquarter")|| "");
            formData.append("card_id",              currentPersonIdx);
            formData.append("enrich_type",          "email");

            try {
                const response = await fetch(ENRICH_PERSON_URL, {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": getCookie("csrftoken"),
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: formData
                });
                const data = await response.json();

                if (!data.success) {
                    showMessage(data.error || "Could not fetch email.", "error");
                    unlockBtn.textContent = origText;
                    unlockBtn.disabled = false;
                    return;
                }

                const person  = data.person || {};
                const emails  = person.emails || [];
                const firstEmail = typeof emails[0] === "string"
                    ? emails[0]
                    : (emails[0] && emails[0].email ? emails[0].email : "");

                if (!firstEmail) {
                    showMessage("No email found for this person.", "error");
                    unlockBtn.textContent = origText;
                    unlockBtn.disabled = false;
                    return;
                }

                // 1. Update row checkbox data-email
                cb.setAttribute("data-email", firstEmail);

                // 2. Update the live contact row inside the drawer
                const contactRow = unlockBtn.closest(".drawer-contact-row");
                if (contactRow) {
                    const contactLeft = contactRow.querySelector(".drawer-contact-left");
                    if (contactLeft) {
                        contactLeft.innerHTML =
                            `<i class="far fa-envelope"></i> <span class="contact-val">${escapeHtml(firstEmail)}</span>`;
                    }
                    unlockBtn.remove();
                }

                // 3. Replace the disabled "Send Email" button with a working form
                const existingSendBtn = drawerContent.querySelector(".drawer-action-btn.primary");
                if (existingSendBtn) {
                    const actionsDiv = existingSendBtn.closest(".drawer-actions");
                    if (actionsDiv) {
                        const csrfToken = getCookie("csrftoken");
                        const form = document.createElement("form");
                        form.method  = "POST";
                        form.action  = SELECT_PERSON_FOR_EMAIL_URL;
                        form.className = "d-inline";
                        form.style.flex = "1";
                        form.innerHTML = `
                            <input type="hidden" name="csrfmiddlewaretoken" value="${escapeHtml(csrfToken)}">
                            <input type="hidden" name="first"               value="${escapeHtml(cb.getAttribute("data-first")              || "")}">
                            <input type="hidden" name="last"                value="${escapeHtml(cb.getAttribute("data-last")               || "")}">
                            <input type="hidden" name="linkedin"            value="${escapeHtml(cb.getAttribute("data-linkedin")           || "")}">
                            <input type="hidden" name="company"             value="${escapeHtml(cb.getAttribute("data-company")            || "")}">
                            <input type="hidden" name="company_website"     value="${escapeHtml(cb.getAttribute("data-company_website")    || "")}">
                            <input type="hidden" name="job_title"           value="${escapeHtml(cb.getAttribute("data-job_title")          || "")}">
                            <input type="hidden" name="institution"         value="${escapeHtml(cb.getAttribute("data-institution")        || "")}">
                            <input type="hidden" name="location"            value="${escapeHtml(cb.getAttribute("data-location")           || "")}">
                            <input type="hidden" name="company_headquarter" value="${escapeHtml(cb.getAttribute("data-company_headquarter")|| "")}">
                            <input type="hidden" name="email"               value="${escapeHtml(firstEmail)}">
                            <button type="submit" class="drawer-action-btn primary" style="width:100%;">
                                <i class="far fa-envelope"></i> Send Email
                            </button>
                        `;
                        existingSendBtn.replaceWith(form);
                    }
                }

                // 4. Update the pre-rendered profile template so re-opening the drawer shows the email
                const profileTpl = document.getElementById("person-profile-" + currentPersonIdx);
                if (profileTpl) {
                    // Update blurred email span → real email
                    const blurredEl = profileTpl.querySelector(".contact-blurred");
                    if (blurredEl) {
                        blurredEl.className = "contact-val";
                        blurredEl.textContent = firstEmail;
                    }
                    // Remove the Save to Unlock link from the template
                    const tplUnlock = profileTpl.querySelector(".drawer-unlock-link");
                    if (tplUnlock) tplUnlock.remove();
                    // Update Send Email button in template
                    const tplSendBtn = profileTpl.querySelector(".drawer-action-btn.primary");
                    if (tplSendBtn) {
                        const csrfToken = getCookie("csrftoken");
                        const tplForm = document.createElement("form");
                        tplForm.method = "POST";
                        tplForm.action = SELECT_PERSON_FOR_EMAIL_URL;
                        tplForm.className = "d-inline";
                        tplForm.style.flex = "1";
                        tplForm.innerHTML = `
                            <input type="hidden" name="csrfmiddlewaretoken" value="${escapeHtml(csrfToken)}">
                            <input type="hidden" name="first"               value="${escapeHtml(cb.getAttribute("data-first")              || "")}">
                            <input type="hidden" name="last"                value="${escapeHtml(cb.getAttribute("data-last")               || "")}">
                            <input type="hidden" name="linkedin"            value="${escapeHtml(cb.getAttribute("data-linkedin")           || "")}">
                            <input type="hidden" name="company"             value="${escapeHtml(cb.getAttribute("data-company")            || "")}">
                            <input type="hidden" name="company_website"     value="${escapeHtml(cb.getAttribute("data-company_website")    || "")}">
                            <input type="hidden" name="job_title"           value="${escapeHtml(cb.getAttribute("data-job_title")          || "")}">
                            <input type="hidden" name="institution"         value="${escapeHtml(cb.getAttribute("data-institution")        || "")}">
                            <input type="hidden" name="location"            value="${escapeHtml(cb.getAttribute("data-location")           || "")}">
                            <input type="hidden" name="company_headquarter" value="${escapeHtml(cb.getAttribute("data-company_headquarter")|| "")}">
                            <input type="hidden" name="email"               value="${escapeHtml(firstEmail)}">
                            <button type="submit" class="drawer-action-btn primary" style="width:100%;">
                                <i class="far fa-envelope"></i> Send Email
                            </button>
                        `;
                        tplSendBtn.replaceWith(tplForm);
                    }
                }

                showMessage("Email fetched successfully!", "success");

            } catch (err) {
                console.error("Drawer enrich error:", err);
                showMessage("Server error while fetching email.", "error");
                unlockBtn.textContent = origText;
                unlockBtn.disabled = false;
            }
        });


        // Click on drawer-trigger cells
        document.addEventListener("click", function (e) {
            const trigger = e.target.closest(".drawer-trigger");
            if (!trigger) return;

            // Don't open if clicking a link inside the cell
            if (e.target.closest("a")) return;

            const row = trigger.closest("tr");
            if (!row) return;

            // Get the person index from the row ID (e.g. "person-card-3" → "3")
            const rowId = row.id || "";
            const personIdx = rowId.replace("person-card-", "");
            if (!personIdx) return;

            // Look up the pre-rendered profile div
            const profileTpl = document.getElementById("person-profile-" + personIdx);
            if (!profileTpl) return;

            // Clone the pre-rendered HTML into the drawer body
            drawerContent.innerHTML = profileTpl.innerHTML;
            currentPersonIdx = personIdx;

            openDrawer();
        });

        function buildDrawerHTML(d) {
            const fullName = [d.first, d.last].filter(Boolean).join(" ") || "Unknown";
            const initials = [(d.first || "").slice(0, 1), (d.last || "").slice(0, 1)].join("").toUpperCase() || "?";
            const photoUrl = d.photo || "";

            // ── Hero ──
            const liLink = d.linkedin
                ? `<a href="${esc(d.linkedin)}" target="_blank" class="li-badge" title="LinkedIn" style="text-decoration:none;">in</a>`
                : "";
            const liLinkName = d.linkedin
                ? `<a href="${esc(d.linkedin)}" target="_blank" style="color:inherit;text-decoration:none;">${esc(fullName)}</a>`
                : esc(fullName);

            let metaRows = "";
            if (d.location) {
                metaRows += `<div class="drawer-meta-item"><i class="fas fa-map-marker-alt"></i><span>${esc(d.location)}</span></div>`;
            }
            if (d.company_headquarter) {
                metaRows += `<div class="drawer-meta-item"><i class="fas fa-map-pin"></i><span>${esc(d.company_headquarter)}</span></div>`;
            }
            if (d.department) {
                metaRows += `<div class="drawer-meta-item"><i class="fas fa-sitemap"></i><span>${esc(d.department)}</span></div>`;
            }

            let tagRow = "";
            if (d.company) {
                const companyInner = d.company_website
                    ? `<a href="${esc(d.company_website)}" target="_blank" style="color:inherit;text-decoration:none;">${esc(d.company)}</a>`
                    : esc(d.company);
                tagRow += `<span class="drawer-tag"><i class="fas fa-building"></i>${companyInner}</span>`;
            }
            if (d.institution) {
                tagRow += `<span class="drawer-tag"><i class="fas fa-graduation-cap"></i>${esc(d.institution)}</span>`;
            }
            if (d.linkedin) {
                tagRow += `<a href="${esc(d.linkedin)}" target="_blank" class="drawer-tag li-tag" style="text-decoration:none;"><i class="fab fa-linkedin-in"></i>LinkedIn</a>`;
            }

            // ── Contacts ──
            let contactRows = "";
            if (d.email) {
                contactRows += `
                    <div class="drawer-contact-row">
                        <div class="drawer-contact-left">
                            <i class="far fa-envelope"></i>
                            <span class="contact-val">${esc(d.email)}</span>
                        </div>
                    </div>`;
            } else {
                contactRows += `
                    <div class="drawer-contact-row">
                        <div class="drawer-contact-left">
                            <i class="far fa-envelope"></i>
                            <span class="contact-blurred">***@******.***</span>
                        </div>
                        <button class="drawer-unlock-btn" type="button">
                            <i class="fas fa-lock" style="font-size:10px;"></i> Save to Unlock
                        </button>
                    </div>`;
            }

            if (d.phone) {
                contactRows += `
                    <div class="drawer-contact-row">
                        <div class="drawer-contact-left">
                            <i class="fas fa-phone-alt"></i>
                            <span class="contact-val">${esc(d.phone)}</span>
                        </div>
                    </div>`;
            } else {
                contactRows += `
                    <div class="drawer-contact-row">
                        <div class="drawer-contact-left">
                            <i class="fas fa-phone-alt"></i>
                            <span class="contact-blurred">+** **-****-****</span>
                        </div>
                        <button class="drawer-unlock-btn" type="button">
                            <i class="fas fa-lock" style="font-size:10px;"></i> Save to Unlock
                        </button>
                    </div>`;
            }

            // ── Tenure Stats ──
            let tenureSection = "";
            if (d.total_experience || d.avg_tenure || d.cur_tenure) {
                tenureSection = `
                    <div class="drawer-section">
                        <div class="drawer-section-title">Work Experience</div>
                        <div class="drawer-tenure-stats">
                            ${d.total_experience ? `<div class="drawer-tenure-card"><div class="tenure-label">Total Tenure</div><div class="tenure-value">${esc(d.total_experience)}</div></div>` : ""}
                            ${d.avg_tenure ? `<div class="drawer-tenure-card"><div class="tenure-label">Average Tenure</div><div class="tenure-value">${esc(d.avg_tenure)}</div></div>` : ""}
                            ${d.cur_tenure ? `<div class="drawer-tenure-card"><div class="tenure-label">Current Tenure</div><div class="tenure-value">${esc(d.cur_tenure)}</div></div>` : ""}
                        </div>
                        ${buildExperienceList(d.experience || [])}
                    </div>`;
            } else if ((d.experience || []).length > 0) {
                tenureSection = `
                    <div class="drawer-section">
                        <div class="drawer-section-title">Work Experience</div>
                        ${buildExperienceList(d.experience)}
                    </div>`;
            }

            // ── Education Section ──
            let educationSection = "";
            if ((d.education || []).length > 0) {
                educationSection = `
                    <div class="drawer-section">
                        <div class="drawer-section-title">Education</div>
                        ${buildEducationList(d.education)}
                    </div>`;
            }

            // ── Skills Section ──
            let skillsSection = `
                <div class="drawer-section">
                    <div class="drawer-section-title">Skills</div>
                    ${
                        (d.skills || []).length > 0
                            ? `<div class="drawer-skills-wrap">${d.skills.map(s => `<span class="drawer-skill-chip">${esc(s)}</span>`).join("")}</div>`
                            : `<div class="drawer-no-data">No skills available</div>`
                    }
                </div>`;

            // ── Action buttons ──
            const emailActionBtn = d.email
                ? `<button class="drawer-action-btn primary" type="button" onclick="window.location.href='mailto:${esc(d.email)}'"><i class="far fa-envelope"></i> Send Email</button>`
                : `<button class="drawer-action-btn primary" type="button" disabled style="opacity:.5;cursor:not-allowed;"><i class="far fa-envelope"></i> Send Email</button>`;
            const liBtn = d.linkedin
                ? `<a href="${esc(d.linkedin)}" target="_blank" class="drawer-action-btn secondary"><i class="fab fa-linkedin-in"></i> LinkedIn</a>`
                : `<button class="drawer-action-btn secondary" type="button" disabled style="opacity:.5;cursor:not-allowed;"><i class="fab fa-linkedin-in"></i> LinkedIn</button>`;

            const avatarContent = photoUrl
                ? `<img src="${esc(photoUrl)}" alt="${esc(fullName)}" onerror="this.style.display='none'; this.nextSibling.style.display='flex'; ">${initials}`
                : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${esc(initials)}</span>`;

            return `
                <div class="drawer-hero">
                    <div class="drawer-hero-top">
                        <div class="drawer-avatar">${avatarContent}</div>
                        <div class="drawer-name-block">
                            <div class="drawer-name">
                                ${liLinkName}
                                ${liLink}
                            </div>
                            ${d.job_title ? `<div class="drawer-job">${esc(d.job_title)}</div>` : ""}
                        </div>
                    </div>
                    <div class="drawer-meta-row">${metaRows}</div>
                    ${tagRow ? `<div class="drawer-tag-row">${tagRow}</div>` : ""}
                </div>

                <div class="drawer-section">
                    <div class="drawer-section-title">Contacts</div>
                    ${contactRows}
                </div>

                ${tenureSection}
                ${educationSection}
                ${skillsSection}

                <div class="drawer-actions">
                    ${emailActionBtn}
                    ${liBtn}
                </div>
            `;
        }

        function buildExperienceList(list) {
            if (!list || !list.length) return "";
            return list.map(exp => {
                const dateRange = [exp.date_from, exp.date_to].filter(Boolean).join(" - ");
                const companyAndLocation = [exp.company, exp.location].filter(Boolean).join(" | ");
                const companyLink = exp.company_url
                    ? `<a href="${esc(exp.company_url)}" target="_blank" style="color:inherit;text-decoration:none;">${esc(companyAndLocation)}</a>`
                    : `<span>${esc(companyAndLocation)}</span>`;

                // Build description bullet points
                let descHtml = "";
                if (exp.description) {
                    const bullets = String(exp.description)
                        .split(/•|\n/)
                        .map(s => s.trim())
                        .filter(Boolean);
                    if (bullets.length > 1) {
                        descHtml = `<ul class="drawer-exp-desc">${bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>`;
                    } else if (bullets.length === 1) {
                        descHtml = `<div class="drawer-exp-desc-text">${esc(bullets[0])}</div>`;
                    }
                }

                return `
                    <div class="drawer-exp-item">
                        <div class="drawer-exp-icon"><i class="fas fa-briefcase"></i></div>
                        <div class="drawer-exp-body">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                                <div class="drawer-exp-title">${esc(exp.title)}</div>
                                ${dateRange ? `<div class="drawer-exp-date">${esc(dateRange)}</div>` : ""}
                            </div>
                            <div class="drawer-exp-company">${companyLink}${exp.duration ? ` <span class="drawer-exp-duration">· ${esc(exp.duration)}</span>` : ""}</div>
                            ${descHtml}
                        </div>
                    </div>`;
            }).join("");
        }

        function buildEducationList(list) {
            if (!list || !list.length) return "";
            return list.map(edu => {
                const dateRange = [edu.date_from, edu.date_to].filter(Boolean).join(" - ");
                return `
                    <div class="drawer-exp-item">
                        <div class="drawer-exp-icon" style="background:#e8f0f9;"><i class="fas fa-graduation-cap" style="color:#1a73e8;"></i></div>
                        <div class="drawer-exp-body">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                                <div class="drawer-exp-title">${esc(edu.title)}</div>
                                ${dateRange ? `<div class="drawer-exp-date">${esc(dateRange)}</div>` : ""}
                            </div>
                            ${edu.major ? `<div class="drawer-exp-company"><a href="#" style="color:#1a73e8;text-decoration:none;">${esc(edu.major)}</a></div>` : ""}
                        </div>
                    </div>`;
            }).join("");
        }
    })();

    // ── Init ──
    setTab("new");
    updateSelectionUI();
    attachEnrichEvents();
});