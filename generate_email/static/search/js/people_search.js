document.addEventListener("DOMContentLoaded", function () {

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

    const loader = document.getElementById("enrichLoader");
    const peopleSearchForm = document.getElementById("peopleSearchForm");

    const tagInputInstances = [];

    document.querySelectorAll(".filter-toggle").forEach(function (button) {
        button.addEventListener("click", function () {
            const parent = button.closest(".filter-item");
            if (parent) {
                parent.classList.toggle("active");
            }
        });
    });

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

    function setupTagInput(config) {
        const input = document.getElementById(config.inputId);
        const addBtn = document.getElementById(config.addBtnId);
        const tagsContainer = document.getElementById(config.tagsContainerId);
        const hiddenInput = document.getElementById(config.hiddenInputId);

        if (!input || !addBtn || !tagsContainer || !hiddenInput) return;

        let tags = [];

        if (hiddenInput.value.trim()) {
            tags = hiddenInput.value
                .split(",")
                .map(function (item) { return item.trim(); })
                .filter(function (item) { return item !== ""; });
        }

        function updateHiddenInput() {
            hiddenInput.value = tags.join(",");
        }

        function renderTags() {
            tagsContainer.innerHTML = "";
            tags.forEach(function (tagValue, index) {
                const tag = document.createElement("div");
                tag.className = "tag";
                tag.innerHTML = '<span class="tag-text">' + escapeHtml(tagValue) + '</span>'
                    + '<span class="tag-remove" data-index="' + index + '">&times;</span>';
                tagsContainer.appendChild(tag);
            });
            tagsContainer.querySelectorAll(".tag-remove").forEach(function (removeBtn) {
                removeBtn.addEventListener("click", function () {
                    const index = parseInt(removeBtn.getAttribute("data-index"), 10);
                    tags.splice(index, 1);
                    updateHiddenInput();
                    renderTags();
                });
            });
        }

        function addTag(value) {
            const finalValue = (value !== undefined && value !== null ? value : input.value).trim();
            if (!finalValue) return;
            const alreadyExists = tags.some(function (tag) {
                return tag.toLowerCase() === finalValue.toLowerCase();
            });
            if (alreadyExists) { input.value = ""; return; }
            tags.push(finalValue);
            updateHiddenInput();
            renderTags();
            input.value = "";
            input.focus();
        }

        function finalizePendingInput() {
            const pendingValue = input.value.trim();
            if (pendingValue) addTag(pendingValue);
        }

        addBtn.addEventListener("click", function () { addTag(); });

        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); addTag(); }
            if (e.key === "Backspace" && !input.value.trim() && tags.length) {
                tags.pop();
                updateHiddenInput();
                renderTags();
            }
        });

        renderTags();
        updateHiddenInput();
        tagInputInstances.push({ finalizePendingInput: finalizePendingInput });
    }

    setupTagInput({ inputId: "nameInput",        addBtnId: "addNameTag",        tagsContainerId: "nameTags",        hiddenInputId: "nameHidden" });
    setupTagInput({ inputId: "locationInput",    addBtnId: "addLocationTag",    tagsContainerId: "locationTags",    hiddenInputId: "locationHidden" });
    setupTagInput({ inputId: "companyInput",     addBtnId: "addCompanyTag",     tagsContainerId: "companyTags",     hiddenInputId: "companyHidden" });
    setupTagInput({ inputId: "specialitesInput", addBtnId: "addSpecialitesTag", tagsContainerId: "specialitesTags", hiddenInputId: "specialitesHidden" });
    setupTagInput({ inputId: "industryInput",    addBtnId: "addIndustryTag",    tagsContainerId: "industryTags",    hiddenInputId: "industryHidden" });
    setupTagInput({ inputId: "jobTitleInput",    addBtnId: "addJobTitleTag",    tagsContainerId: "jobTitleTags",    hiddenInputId: "jobTitleHidden" });
    setupTagInput({ inputId: "skillsInput",      addBtnId: "addSkillsTag",      tagsContainerId: "skillsTags",      hiddenInputId: "skillsHidden" });
    setupTagInput({ inputId: "institutionInput", addBtnId: "addInstitutionTag", tagsContainerId: "institutionTags", hiddenInputId: "institutionHidden" });
    setupTagInput({ inputId: "degreeInput",      addBtnId: "addDegreeTag",      tagsContainerId: "degreeTags",      hiddenInputId: "degreeHidden" });

    if (peopleSearchForm) {
        peopleSearchForm.addEventListener("submit", function () {
            tagInputInstances.forEach(function (instance) {
                instance.finalizePendingInput();
            });
        });
    }

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
        selectedCountText.textContent = checkedCount + " selected of " + totalCount + " results";
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

    rowCheckboxes.forEach(function (cb) { cb.addEventListener("change", updateSelectionUI); });

    if (saveToListBtn) {
        saveToListBtn.addEventListener("click", async function () {
            await loadExistingLists();
            setTab("new");
            openModal();
        });
    }

    if (closeSaveListModal) closeSaveListModal.addEventListener("click", closeModal);
    if (cancelSaveListBtn) cancelSaveListBtn.addEventListener("click", closeModal);

    if (newListTab) {
        newListTab.addEventListener("click", function () { setTab("new"); });
    }

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
            confirmSaveListBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
 
            const response = await fetch(SAVE_ENRICH_CAMPAIGN_URL, {
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
                confirmSaveListBtn.disabled = false;
                confirmSaveListBtn.innerHTML = "Save to List";
                return;
            }
 
            // ── No enrichment needed → redirect immediately ──────────────
            if (!data.pending || !data.request_ids || !data.request_ids.length) {
                confirmSaveListBtn.innerHTML = "✅ Done! Redirecting...";
                showMessage(data.message || "Saved successfully.", "success");
                closeModal();
                setTimeout(function () { window.location.href = data.redirect_url; }, 1200);
                return;
            }
 
            // ── Enrichment pending → poll CheckBulkEnrichmentView ────────
            const requestIds  = data.request_ids;
            const redirectUrl = data.redirect_url;
            const total       = requestIds.length;
 
            closeModal();
            showMessage(`Enriching ${total} contacts… this may take a moment.`, "success");
 
            // Show a persistent progress bar while polling
            let progressBar = document.getElementById("enrichProgressBar");
            if (!progressBar) {
                progressBar = document.createElement("div");
                progressBar.id = "enrichProgressBar";
                progressBar.style.cssText = [
                    "position:fixed", "bottom:20px", "left:50%",
                    "transform:translateX(-50%)",
                    "background:#fff", "border-radius:14px",
                    "box-shadow:0 4px 24px rgba(0,0,0,.15)",
                    "padding:16px 24px", "z-index:99999",
                    "min-width:300px", "text-align:center",
                    "font-size:14px", "font-weight:600", "color:#2e374d"
                ].join(";");
                document.body.appendChild(progressBar);
            }
 
            function updateProgress(done, total) {
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                progressBar.innerHTML =
                    `<i class="fas fa-spinner fa-spin me-2" style="color:#6276ea;"></i>` +
                    `Enriching contacts… ${done}/${total} done` +
                    `<div style="margin-top:10px;height:6px;background:#eef0f4;border-radius:99px;overflow:hidden;">` +
                    `<div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#6276ea,#7c4fc8);border-radius:99px;transition:width .4s;"></div>` +
                    `</div>`;
            }
 
            updateProgress(0, total);
 
            // Poll every 3 seconds for up to 40 attempts (2 minutes)
            let allDone = false;
            for (let attempt = 0; attempt < 40; attempt++) {
                await new Promise(function (res) { setTimeout(res, 3000); });
 
                let checkData;
                try {
                    const pollResp = await fetch(
                        CHECK_BULK_ENRICHMENT_URL + "?request_ids=" + requestIds.join(","),
                        { headers: { "X-Requested-With": "XMLHttpRequest" } }
                    );
                    checkData = await pollResp.json();
                } catch (pollErr) {
                    console.warn("[Bulk enrich poll] fetch error:", pollErr);
                    continue;
                }
 
                updateProgress(checkData.done || 0, checkData.total || total);
 
                // Update credit pill if server returned updated count
                if (typeof checkData.credits === "number") {
                    if (typeof slUpdatePill === "function") slUpdatePill(checkData.credits);
                }
 
                if (checkData.all_done) {
                    allDone = true;
                    break;
                }
            }
 
            // Remove progress bar and redirect
            if (progressBar) progressBar.remove();
 
            if (allDone) {
                showMessage("Enrichment complete! Redirecting to campaign...", "success");
            } else {
                // Timed out but still redirect — emails enriched so far are saved
                showMessage("Enrichment is still running in background. Redirecting...", "success");
            }
 
            setTimeout(function () { window.location.href = redirectUrl; }, 1500);
 
        } catch (error) {
            console.error("Save & enrich error:", error);
            showMessage("Server error while saving list.", "error");
            confirmSaveListBtn.disabled = false;
            confirmSaveListBtn.innerHTML = "Save to List";
        }
    });
}

    // ══════════════════════════════════════
    //  ENRICH EVENTS
    // ══════════════════════════════════════
    function attachEnrichEvents() {

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

        // ── Update table cells and action button after enrichment resolves ──
        function applyEnrichmentToRow(cardRow, cardId, email, phone, csrfToken) {
    // 1. Update email column cell
    if (email) {
        const emailColCell = document.querySelector(".email-col-" + cardId);
        if (emailColCell) {
            emailColCell.innerHTML =
                '<span class="contact-col-pill contact-col-email">'
                + '<i class="far fa-envelope me-1"></i>'
                + escapeHtml(email)
                + '</span>';
        }
    }

    // 2. Update phone column cell
    if (phone) {
        const phoneColCell = document.querySelector(".phone-col-" + cardId);
        if (phoneColCell) {
            phoneColCell.innerHTML =
                '<span class="contact-col-pill contact-col-phone">'
                + '<i class="fas fa-phone-alt me-1" style="font-size:10px;"></i>'
                + escapeHtml(phone)
                + '</span>';
        }
    }

    // 3. Replace email enrich-form with Send Email button
    if (email) {
        const actionTd = cardRow.querySelector(".action-icons");
        if (actionTd) {
            const enrichTypeInput = actionTd.querySelector('.enrich-form input[name="enrich_type"][value="email"]');
            if (enrichTypeInput) {
                const oldForm = enrichTypeInput.closest("form");
                if (oldForm) {
                    const cb = cardRow.querySelector(".row-checkbox");
                    const newForm = document.createElement("form");
                    newForm.method = "POST";
                    newForm.action = SELECT_PERSON_FOR_EMAIL_URL;
                    newForm.className = "d-inline";
                    newForm.innerHTML =
                        '<input type="hidden" name="csrfmiddlewaretoken" value="' + escapeHtml(csrfToken) + '">'
                        + '<input type="hidden" name="first"               value="' + escapeHtml(cb ? cb.getAttribute("data-first") || "" : "") + '">'
                        + '<input type="hidden" name="last"                value="' + escapeHtml(cb ? cb.getAttribute("data-last") || "" : "") + '">'
                        + '<input type="hidden" name="linkedin"            value="' + escapeHtml(cb ? cb.getAttribute("data-linkedin") || "" : "") + '">'
                        + '<input type="hidden" name="company"             value="' + escapeHtml(cb ? cb.getAttribute("data-company") || "" : "") + '">'
                        + '<input type="hidden" name="company_website"     value="' + escapeHtml(cb ? cb.getAttribute("data-company_website") || "" : "") + '">'
                        + '<input type="hidden" name="job_title"           value="' + escapeHtml(cb ? cb.getAttribute("data-job_title") || "" : "") + '">'
                        + '<input type="hidden" name="institution"         value="' + escapeHtml(cb ? cb.getAttribute("data-institution") || "" : "") + '">'
                        + '<input type="hidden" name="location"            value="' + escapeHtml(cb ? cb.getAttribute("data-location") || "" : "") + '">'
                        + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(cb ? cb.getAttribute("data-company_headquarter") || "" : "") + '">'
                        + '<input type="hidden" name="email"               value="' + escapeHtml(email) + '">'
                        + '<button type="submit" class="send-email-col-btn" title="Send Email">'
                        + '<i class="far fa-envelope me-1"></i> Send Email</button>';
                    oldForm.replaceWith(newForm);
                }
            }
        }
    }

    // ── 4. ADD THIS BLOCK — Sync drawer template so opening drawer shows fetched data ──
    const profileTpl = document.getElementById("person-profile-" + cardId);
    if (profileTpl) {
        const cb = cardRow.querySelector(".row-checkbox");

        if (email) {
            // Show email instead of blurred
            const contactRows = profileTpl.querySelectorAll(".drawer-contact-row");
            if (contactRows[0]) {
                const blurredEl = contactRows[0].querySelector(".contact-blurred");
                if (blurredEl) {
                    blurredEl.className = "contact-val";
                    blurredEl.textContent = email;
                }
                const unlockBtn = contactRows[0].querySelector(".drawer-unlock-link");
                if (unlockBtn) unlockBtn.remove();
            }

            // Replace disabled Send Email button with working form
            const tplSendBtn = profileTpl.querySelector(".drawer-action-btn.primary");
            if (tplSendBtn && tplSendBtn.disabled) {
                const tplForm = document.createElement("form");
                tplForm.method = "POST";
                tplForm.action = SELECT_PERSON_FOR_EMAIL_URL;
                tplForm.className = "d-inline";
                tplForm.style.flex = "1";
                tplForm.innerHTML =
                    '<input type="hidden" name="csrfmiddlewaretoken" value="' + escapeHtml(csrfToken) + '">'
                    + '<input type="hidden" name="first"               value="' + escapeHtml(cb ? cb.getAttribute("data-first") || "" : "") + '">'
                    + '<input type="hidden" name="last"                value="' + escapeHtml(cb ? cb.getAttribute("data-last") || "" : "") + '">'
                    + '<input type="hidden" name="linkedin"            value="' + escapeHtml(cb ? cb.getAttribute("data-linkedin") || "" : "") + '">'
                    + '<input type="hidden" name="company"             value="' + escapeHtml(cb ? cb.getAttribute("data-company") || "" : "") + '">'
                    + '<input type="hidden" name="company_website"     value="' + escapeHtml(cb ? cb.getAttribute("data-company_website") || "" : "") + '">'
                    + '<input type="hidden" name="job_title"           value="' + escapeHtml(cb ? cb.getAttribute("data-job_title") || "" : "") + '">'
                    + '<input type="hidden" name="institution"         value="' + escapeHtml(cb ? cb.getAttribute("data-institution") || "" : "") + '">'
                    + '<input type="hidden" name="location"            value="' + escapeHtml(cb ? cb.getAttribute("data-location") || "" : "") + '">'
                    + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(cb ? cb.getAttribute("data-company_headquarter") || "" : "") + '">'
                    + '<input type="hidden" name="email"               value="' + escapeHtml(email) + '">'
                    + '<button type="submit" class="drawer-action-btn primary" style="width:100%;"><i class="far fa-envelope"></i> Send Email</button>';
                tplSendBtn.replaceWith(tplForm);
            }
        }

        if (phone) {
            // Show phone instead of blurred
            const contactRows = profileTpl.querySelectorAll(".drawer-contact-row");
            if (contactRows[1]) {
                const blurredEl = contactRows[1].querySelector(".contact-blurred");
                if (blurredEl) {
                    blurredEl.className = "contact-val";
                    blurredEl.textContent = phone;
                }
                const unlockBtn = contactRows[1].querySelector(".drawer-unlock-link");
                if (unlockBtn) unlockBtn.remove();
            }
        }
    }
    // ── END OF ADDED BLOCK ──
}

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

        document.querySelectorAll(".enrich-form").forEach(function (form) {
            form.addEventListener("submit", async function (e) {
                e.preventDefault();

                const formData = new FormData(form);
                const csrfTokenInput = form.querySelector("[name=csrfmiddlewaretoken]");
                const csrfToken = csrfTokenInput ? csrfTokenInput.value : getCookie("csrftoken");
                const cardId = formData.get("card_id");
                const enrichType = formData.get("enrich_type") || "email";

                const cardRow = document.getElementById("person-card-" + cardId);
                const extraRow = document.getElementById("person-extra-" + cardId);

                if (!cardRow) return;

                const rowCheckbox = cardRow.querySelector(".row-checkbox");
                const existingEmail = rowCheckbox ? (rowCheckbox.getAttribute("data-email") || "") : "";
                const existingPhone = rowCheckbox ? (rowCheckbox.getAttribute("data-phone") || "") : "";

                // Already have the data — just update cells immediately
                if (enrichType === "email" && existingEmail) {
                    applyEnrichmentToRow(cardRow, cardId, existingEmail, existingPhone, csrfToken);
                    if (extraRow) extraRow.style.display = "none";
                    return;
                }
                if (enrichType === "phone" && existingPhone) {
                    applyEnrichmentToRow(cardRow, cardId, existingEmail, existingPhone, csrfToken);
                    if (extraRow) extraRow.style.display = "none";
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

                    if (!data.success) {
                        if (loader) loader.style.display = "none";
                        showMessage(data.error || "Something went wrong.", "error");
                        return;
                    }

                    // ── Webhook/polling flow ──
                    if (data.pending && data.request_id) {
                        const requestId = data.request_id;
                        let resolved = false;

                        for (let attempt = 0; attempt < 40; attempt++) {
                            await new Promise(function (res) { setTimeout(res, 3000); });

                            let checkResp, checkData;
                            try {
                                const pollUrl = CHECK_ENRICHMENT_URL.replace("PLACEHOLDER", requestId);
                                checkResp = await fetch(pollUrl, {
                                    method: "GET",
                                    headers: { "X-Requested-With": "XMLHttpRequest" }
                                });
                                checkData = await checkResp.json();
                            } catch (pollErr) {
                                console.warn("[Enrich poll] fetch error:", pollErr);
                                continue;
                            }

                            if (!checkData.pending) {
                                const existingEmail = rowCheckbox ? (rowCheckbox.getAttribute("data-email") || "") : "";
                                const existingPhone = rowCheckbox ? (rowCheckbox.getAttribute("data-phone") || "") : "";
                                const fe = checkData.email || existingEmail;
                                const fp = checkData.phone || existingPhone;

                                // Update checkbox data attributes
                                if (rowCheckbox) {
                                    if (fe) rowCheckbox.setAttribute("data-email", fe);
                                    if (fp) rowCheckbox.setAttribute("data-phone", fp);
                                }

                                // Update DOM cells directly
                                applyEnrichmentToRow(cardRow, cardId, fe, fp, getCookie("csrftoken"));

                                if (extraRow) extraRow.style.display = "none";
                                if (loader) loader.style.display = "none";

                                // ── Update credit pill live ──
                                if (typeof checkData.credits === "number" && typeof slUpdatePill === "function") {
                                    slUpdatePill(checkData.credits);
                                }

                                if (!fe && !fp) {
                                    showMessage("No contact info found for this person.", "error");
                                } else {
                                    showMessage("Contact info fetched successfully!", "success");
                                }

                                resolved = true;
                                break;
                            }
                        }

                        if (loader) loader.style.display = "none";

                        if (!resolved) {
                            showMessage("Enrichment is taking longer than expected. Please try again later.", "error");
                        }
                        return;
                    }

                    // ── Legacy / direct response (no webhook) ──
                    if (loader) loader.style.display = "none";

                    const person = data.person || {};
                    const firstEmail = getFirstEmail(person);
                    const firstPhone = getFirstPhone(person);

                    const finalEmail = firstEmail || existingEmail;
                    const finalPhone = firstPhone || existingPhone;

                    if (rowCheckbox) {
                        rowCheckbox.setAttribute("data-first",               person.first || "");
                        rowCheckbox.setAttribute("data-last",                person.last || "");
                        rowCheckbox.setAttribute("data-linkedin",            person.linkedin || "");
                        rowCheckbox.setAttribute("data-company",             person.company || "");
                        rowCheckbox.setAttribute("data-company_website",     person.company_website || "");
                        rowCheckbox.setAttribute("data-job_title",           person.job_title || "");
                        rowCheckbox.setAttribute("data-institution",         person.institution || "");
                        rowCheckbox.setAttribute("data-location",            person.location || "");
                        rowCheckbox.setAttribute("data-company_headquarter", person.company_headquarter || "");
                        rowCheckbox.setAttribute("data-email",               finalEmail);
                        rowCheckbox.setAttribute("data-phone",               finalPhone);
                    }

                    applyEnrichmentToRow(cardRow, cardId, finalEmail, finalPhone, csrfToken);
                    if (extraRow) extraRow.style.display = "none";

                } catch (error) {
                    if (loader) loader.style.display = "none";
                    showMessage("Server error while fetching contact.", "error");
                    console.error(error);
                }
            });
        });
    }

    setTab("new");
    updateSelectionUI();
    attachEnrichEvents();

    // ── Global Tooltip Logic ──
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
        let top  = rect.bottom + window.scrollY + 6;
        let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipEl.offsetWidth / 2);
        if (left < 10) left = 10;
        if (left + tooltipEl.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltipEl.offsetWidth - 10;
        }
        tooltipEl.style.top  = top + "px";
        tooltipEl.style.left = left + "px";
    });

    document.addEventListener("mouseout", function (e) {
        if (e.target.closest("[data-tooltip]")) tooltipEl.classList.remove("visible");
    });

    window.addEventListener("scroll", function () { tooltipEl.classList.remove("visible"); });

    // ── Single row Save to List button ──
    document.addEventListener("click", function (e) {
        const singleSaveBtn = e.target.closest(".single-save-btn");
        if (!singleSaveBtn) return;

        document.querySelectorAll(".row-checkbox").forEach(function (cb) { cb.checked = false; });
        const selectAll = document.getElementById("selectAllRows");
        if (selectAll) selectAll.checked = false;

        const row = singleSaveBtn.closest("tr");
        if (row) {
            const cb = row.querySelector(".row-checkbox");
            if (cb) cb.checked = true;
        }

        updateSelectionUI();
        const btn = document.getElementById("saveToListBtn");
        if (btn) btn.click();
    });

    // ── Mobile Filter Toggle ──
    const mobileFilterBtn = document.getElementById("mobileFilterBtn");
    const filtersPanel = document.querySelector(".filters-panel");
    const mobileOverlay = document.createElement("div");
    mobileOverlay.className = "mobile-filter-overlay";
    document.body.appendChild(mobileOverlay);

    if (mobileFilterBtn) {
        mobileFilterBtn.style.display = window.innerWidth <= 860 ? "inline-flex" : "none";
    }

    window.addEventListener("resize", function () {
        if (!mobileFilterBtn) return;
        if (window.innerWidth <= 860) {
            mobileFilterBtn.style.display = "inline-flex";
        } else {
            mobileFilterBtn.style.display = "none";
            if (filterOpen) closeFilter();
        }
    });

    if (mobileFilterBtn && filtersPanel) {
        var filterOpen = false;

        function openFilter() {
            filterOpen = true;
            filtersPanel.style.setProperty("position",   "fixed",    "important");
            filtersPanel.style.setProperty("left",       "0",        "important");
            filtersPanel.style.setProperty("top",        "0",        "important");
            filtersPanel.style.setProperty("width",      "300px",    "important");
            filtersPanel.style.setProperty("height",     "100vh",    "important");
            filtersPanel.style.setProperty("min-height", "100vh",    "important");
            filtersPanel.style.setProperty("overflow-y", "auto",     "important");
            filtersPanel.style.setProperty("padding",    "0.75rem",  "important");
            filtersPanel.style.setProperty("z-index",    "9500",     "important");
            filtersPanel.style.setProperty("max-height", "none",     "important");
            mobileFilterBtn.innerHTML = '<i class="fas fa-times"></i> Close';
            mobileOverlay.classList.add("show");
            document.body.style.overflow = "hidden";
        }

        function closeFilter() {
            filterOpen = false;
            filtersPanel.style.removeProperty("position");
            filtersPanel.style.removeProperty("left");
            filtersPanel.style.removeProperty("top");
            filtersPanel.style.removeProperty("width");
            filtersPanel.style.removeProperty("height");
            filtersPanel.style.removeProperty("min-height");
            filtersPanel.style.removeProperty("overflow-y");
            filtersPanel.style.removeProperty("padding");
            filtersPanel.style.removeProperty("z-index");
            filtersPanel.style.removeProperty("max-height");
            mobileFilterBtn.innerHTML = '<i class="fas fa-filter"></i> Filters';
            mobileOverlay.classList.remove("show");
            document.body.style.overflow = "";
        }

        mobileFilterBtn.addEventListener("click", function () {
            if (filterOpen) { closeFilter(); } else { openFilter(); }
        });
        mobileOverlay.addEventListener("click", function () { closeFilter(); });
    }

    // ══════════════════════════════════════
    //  PROFILE DRAWER
    // ══════════════════════════════════════
    (function initProfileDrawer() {
        const drawer        = document.getElementById("profileDrawer");
        const overlay       = document.getElementById("profileDrawerOverlay");
        const closeBtn      = document.getElementById("closeProfileDrawer");
        const saveBtn       = document.getElementById("drawerSaveToListBtn");
        const drawerContent = document.getElementById("profileDrawerContent");

        if (!drawer || !overlay || !drawerContent) return;

        let currentPersonIdx = null;

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
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });

        if (saveBtn) {
            saveBtn.addEventListener("click", async function () {
                if (currentPersonIdx === null) return;
                document.querySelectorAll(".row-checkbox").forEach(function (cb) { cb.checked = false; });
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

        // ── Drawer "Enrich email" button ──
        drawerContent.addEventListener("click", async function (e) {
            const unlockBtn = e.target.closest(".drawer-unlock-link");
            if (!unlockBtn) return;
            if (currentPersonIdx === null) return;

            const row = document.getElementById("person-card-" + currentPersonIdx);
            if (!row) return;
            const cb = row.querySelector(".row-checkbox");
            if (!cb) return;

            const origText = unlockBtn.textContent;
            unlockBtn.textContent = "Fetching…";
            unlockBtn.disabled = true;

            const formData = new FormData();
            formData.append("csrfmiddlewaretoken",  getCookie("csrftoken"));
            formData.append("linkedin_url",          cb.getAttribute("data-linkedin")            || "");
            formData.append("first",                 cb.getAttribute("data-first")               || "");
            formData.append("last",                  cb.getAttribute("data-last")                || "");
            formData.append("company",               cb.getAttribute("data-company")             || "");
            formData.append("company_website",       cb.getAttribute("data-company_website")     || "");
            formData.append("job_title",             cb.getAttribute("data-job_title")           || "");
            formData.append("institution",           cb.getAttribute("data-institution")         || "");
            formData.append("location",              cb.getAttribute("data-location")            || "");
            formData.append("company_headquarter",   cb.getAttribute("data-company_headquarter") || "");
            formData.append("card_id",               currentPersonIdx);
            formData.append("enrich_type",           "email");

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

                let firstEmail = "";

                // ── Webhook polling ──
                if (data.pending && data.request_id) {
                    const requestId = data.request_id;
                    unlockBtn.textContent = "Waiting…";
                    let resolved = false;

                    for (let attempt = 0; attempt < 40; attempt++) {
                        await new Promise(function (res) { setTimeout(res, 3000); });
                        let checkResp, checkData;
                        try {
                            const pollUrl = CHECK_ENRICHMENT_URL.replace("PLACEHOLDER", requestId);
                            checkResp = await fetch(pollUrl, {
                                method: "GET",
                                headers: { "X-Requested-With": "XMLHttpRequest" }
                            });
                            checkData = await checkResp.json();
                        } catch (pollErr) {
                            console.warn("[Drawer poll] fetch error:", pollErr);
                            continue;
                        }
                        if (!checkData.pending) {
                            firstEmail = checkData.email || "";
                            // ── Update credit pill live ──
                            if (typeof checkData.credits === "number" && typeof slUpdatePill === "function") {
                                slUpdatePill(checkData.credits);
                            }
                            resolved = true;
                            break;
                        }
                    }

                    if (!resolved) {
                        showMessage("Enrichment timed out. Please try again.", "error");
                        unlockBtn.textContent = origText;
                        unlockBtn.disabled = false;
                        return;
                    }
                } else {
                    // Legacy direct result
                    const person = data.person || {};
                    const emails = person.emails || [];
                    firstEmail = typeof emails[0] === "string"
                        ? emails[0]
                        : (emails[0] && emails[0].email ? emails[0].email : "");
                    if (!firstEmail) firstEmail = data.email || "";
                }

                if (!firstEmail) {
                    showMessage("No email found for this person.", "error");
                    unlockBtn.textContent = origText;
                    unlockBtn.disabled = false;
                    return;
                }

                // 1. Update row checkbox
                cb.setAttribute("data-email", firstEmail);

                // 2. Update the table cells for this row
                applyEnrichmentToRowFromDrawer(row, currentPersonIdx, firstEmail, getCookie("csrftoken"));

                // 3. Update the live contact row inside the drawer
                const contactRow = unlockBtn.closest(".drawer-contact-row");
                if (contactRow) {
                    const contactLeft = contactRow.querySelector(".drawer-contact-left");
                    if (contactLeft) {
                        contactLeft.innerHTML =
                            '<i class="far fa-envelope"></i> <span class="contact-val">' + escapeHtml(firstEmail) + '</span>';
                    }
                    unlockBtn.remove();
                }

                // 4. Replace disabled Send Email button with working form in drawer
                const existingSendBtn = drawerContent.querySelector(".drawer-action-btn.primary");
                if (existingSendBtn) {
                    const actionsDiv = existingSendBtn.closest(".drawer-actions");
                    if (actionsDiv) {
                        const csrfToken = getCookie("csrftoken");
                        const form = document.createElement("form");
                        form.method    = "POST";
                        form.action    = SELECT_PERSON_FOR_EMAIL_URL;
                        form.className = "d-inline";
                        form.style.flex = "1";
                        form.innerHTML =
                            '<input type="hidden" name="csrfmiddlewaretoken" value="' + escapeHtml(csrfToken) + '">'
                            + '<input type="hidden" name="first"               value="' + escapeHtml(cb.getAttribute("data-first") || "") + '">'
                            + '<input type="hidden" name="last"                value="' + escapeHtml(cb.getAttribute("data-last") || "") + '">'
                            + '<input type="hidden" name="linkedin"            value="' + escapeHtml(cb.getAttribute("data-linkedin") || "") + '">'
                            + '<input type="hidden" name="company"             value="' + escapeHtml(cb.getAttribute("data-company") || "") + '">'
                            + '<input type="hidden" name="company_website"     value="' + escapeHtml(cb.getAttribute("data-company_website") || "") + '">'
                            + '<input type="hidden" name="job_title"           value="' + escapeHtml(cb.getAttribute("data-job_title") || "") + '">'
                            + '<input type="hidden" name="institution"         value="' + escapeHtml(cb.getAttribute("data-institution") || "") + '">'
                            + '<input type="hidden" name="location"            value="' + escapeHtml(cb.getAttribute("data-location") || "") + '">'
                            + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(cb.getAttribute("data-company_headquarter") || "") + '">'
                            + '<input type="hidden" name="email"               value="' + escapeHtml(firstEmail) + '">'
                            + '<button type="submit" class="drawer-action-btn primary" style="width:100%;">'
                            + '<i class="far fa-envelope"></i> Send Email</button>';
                        existingSendBtn.replaceWith(form);
                    }
                }

                // 5. Update pre-rendered profile template so re-opening the drawer shows email
                const profileTpl = document.getElementById("person-profile-" + currentPersonIdx);
                if (profileTpl) {
                    const blurredEl = profileTpl.querySelector(".contact-blurred");
                    if (blurredEl) {
                        blurredEl.className   = "contact-val";
                        blurredEl.textContent = firstEmail;
                    }
                    const tplUnlock = profileTpl.querySelector(".drawer-unlock-link");
                    if (tplUnlock) tplUnlock.remove();

                    const tplSendBtn = profileTpl.querySelector(".drawer-action-btn.primary");
                    if (tplSendBtn) {
                        const csrfToken = getCookie("csrftoken");
                        const tplForm = document.createElement("form");
                        tplForm.method    = "POST";
                        tplForm.action    = SELECT_PERSON_FOR_EMAIL_URL;
                        tplForm.className = "d-inline";
                        tplForm.style.flex = "1";
                        tplForm.innerHTML =
                            '<input type="hidden" name="csrfmiddlewaretoken" value="' + escapeHtml(csrfToken) + '">'
                            + '<input type="hidden" name="first"               value="' + escapeHtml(cb.getAttribute("data-first") || "") + '">'
                            + '<input type="hidden" name="last"                value="' + escapeHtml(cb.getAttribute("data-last") || "") + '">'
                            + '<input type="hidden" name="linkedin"            value="' + escapeHtml(cb.getAttribute("data-linkedin") || "") + '">'
                            + '<input type="hidden" name="company"             value="' + escapeHtml(cb.getAttribute("data-company") || "") + '">'
                            + '<input type="hidden" name="company_website"     value="' + escapeHtml(cb.getAttribute("data-company_website") || "") + '">'
                            + '<input type="hidden" name="job_title"           value="' + escapeHtml(cb.getAttribute("data-job_title") || "") + '">'
                            + '<input type="hidden" name="institution"         value="' + escapeHtml(cb.getAttribute("data-institution") || "") + '">'
                            + '<input type="hidden" name="location"            value="' + escapeHtml(cb.getAttribute("data-location") || "") + '">'
                            + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(cb.getAttribute("data-company_headquarter") || "") + '">'
                            + '<input type="hidden" name="email"               value="' + escapeHtml(firstEmail) + '">'
                            + '<button type="submit" class="drawer-action-btn primary" style="width:100%;">'
                            + '<i class="far fa-envelope"></i> Send Email</button>';
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

        // ── Helper: update table row cells from drawer context ──
        function applyEnrichmentToRowFromDrawer(cardRow, cardId, email, csrfToken) {
            if (email) {
                const emailColCell = document.querySelector(".email-col-" + cardId);
                if (emailColCell) {
                    emailColCell.innerHTML =
                        '<span class="contact-col-pill contact-col-email">'
                        + '<i class="far fa-envelope me-1"></i>'
                        + escapeHtml(email)
                        + '</span>';
                }

                const actionTd = cardRow.querySelector(".action-icons");
                if (actionTd) {
                    const enrichTypeInput = actionTd.querySelector('.enrich-form input[name="enrich_type"][value="email"]');
                    if (enrichTypeInput) {
                        const oldForm = enrichTypeInput.closest("form");
                        if (oldForm) {
                            const cb = cardRow.querySelector(".row-checkbox");
                            const newForm = document.createElement("form");
                            newForm.method = "POST";
                            newForm.action = SELECT_PERSON_FOR_EMAIL_URL;
                            newForm.className = "d-inline";
                            newForm.innerHTML =
                                '<input type="hidden" name="csrfmiddlewaretoken" value="' + escapeHtml(csrfToken) + '">'
                                + '<input type="hidden" name="first"               value="' + escapeHtml(cb ? cb.getAttribute("data-first") || "" : "") + '">'
                                + '<input type="hidden" name="last"                value="' + escapeHtml(cb ? cb.getAttribute("data-last") || "" : "") + '">'
                                + '<input type="hidden" name="linkedin"            value="' + escapeHtml(cb ? cb.getAttribute("data-linkedin") || "" : "") + '">'
                                + '<input type="hidden" name="company"             value="' + escapeHtml(cb ? cb.getAttribute("data-company") || "" : "") + '">'
                                + '<input type="hidden" name="company_website"     value="' + escapeHtml(cb ? cb.getAttribute("data-company_website") || "" : "") + '">'
                                + '<input type="hidden" name="job_title"           value="' + escapeHtml(cb ? cb.getAttribute("data-job_title") || "" : "") + '">'
                                + '<input type="hidden" name="institution"         value="' + escapeHtml(cb ? cb.getAttribute("data-institution") || "" : "") + '">'
                                + '<input type="hidden" name="location"            value="' + escapeHtml(cb ? cb.getAttribute("data-location") || "" : "") + '">'
                                + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(cb ? cb.getAttribute("data-company_headquarter") || "" : "") + '">'
                                + '<input type="hidden" name="email"               value="' + escapeHtml(email) + '">'
                                + '<button type="submit" class="send-email-col-btn" title="Send Email">'
                                + '<i class="far fa-envelope me-1"></i> Send Email</button>';
                            oldForm.replaceWith(newForm);
                        }
                    }
                }
            }
        }

        // ── Click on drawer-trigger cells ──
        document.addEventListener("click", function (e) {
            const trigger = e.target.closest(".drawer-trigger");
            if (!trigger) return;
            if (e.target.closest("a")) return;

            const row = trigger.closest("tr");
            if (!row) return;

            const rowId = row.id || "";
            const personIdx = rowId.replace("person-card-", "");
            if (!personIdx) return;

            const profileTpl = document.getElementById("person-profile-" + personIdx);
            if (!profileTpl) return;

            drawerContent.innerHTML = profileTpl.innerHTML;
            currentPersonIdx = personIdx;
            openDrawer();
        });

    })();

});