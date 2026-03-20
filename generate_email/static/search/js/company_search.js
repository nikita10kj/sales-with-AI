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

    // ── Filter accordion ──
    document.querySelectorAll(".filter-toggle").forEach(function (button) {
        button.addEventListener("click", function () {
            const parent = button.closest(".filter-item");
            if (parent) parent.classList.toggle("active");
        });
    });

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

    // ── Tag input system ──
    const tagInputInstances = [];

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
                tag.innerHTML = `
                    <span class="tag-text">${escapeHtml(tagValue)}</span>
                    <span class="tag-remove" data-index="${index}">&times;</span>
                `;
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

        function addTag(value = null) {
            const finalValue = (value !== null ? value : input.value).trim();
            if (!finalValue) return;
            const alreadyExists = tags.some(function (tag) {
                return tag.toLowerCase() === finalValue.toLowerCase();
            });
            if (alreadyExists) {
                input.value = "";
                input.focus();
                return;
            }
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
            if (e.key === "Enter") {
                e.preventDefault();
                addTag();
            }
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

    setupTagInput({ inputId: "companyInput",            addBtnId: "addCompanyTag",             tagsContainerId: "companyTags",             hiddenInputId: "companyHidden" });
    setupTagInput({ inputId: "industryInput",           addBtnId: "addIndustryTag",            tagsContainerId: "industryTags",            hiddenInputId: "industryHidden" });
    setupTagInput({ inputId: "companyLocationInput",    addBtnId: "addCompanyLocationTag",     tagsContainerId: "companyLocationTags",     hiddenInputId: "companyLocationHidden" });
    setupTagInput({ inputId: "companySpecialitesInput", addBtnId: "addCompanySpecialitesTag",  tagsContainerId: "companySpecialitesTags",  hiddenInputId: "companySpecialitesHidden" });
    setupTagInput({ inputId: "employeeCountInput",      addBtnId: "addEmployeeCountTag",       tagsContainerId: "employeeCountTags",       hiddenInputId: "employeeCountHidden" });
    setupTagInput({ inputId: "companyTechnologiesInput",addBtnId: "addCompanyTechnologiesTag", tagsContainerId: "companyTechnologiesTags", hiddenInputId: "companyTechnologiesHidden" });
    setupTagInput({ inputId: "jobPostsInput",           addBtnId: "addJobPostsTag",            tagsContainerId: "jobPostsTags",            hiddenInputId: "jobPostsHidden" });

    const companySearchForm = document.getElementById("companySearchForm");
    if (companySearchForm) {
        companySearchForm.addEventListener("submit", function () {
            tagInputInstances.forEach(function (instance) {
                instance.finalizePendingInput();
            });
        });
    }

    // ── Selection & Save to List ──
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

    function collectSelectedCompanies() {
        const selected = [];
        document.querySelectorAll(".row-checkbox:checked").forEach(function (cb) {
            selected.push({
                name:          cb.dataset.name           || "",
                linkedin_url:  cb.dataset.linkedin_url   || "",
                website:       cb.dataset.website        || "",
                industry:      cb.dataset.industry       || "",
                domain:        cb.dataset.domain         || "",
                revenue:       cb.dataset.revenue        || "",
                specialties:   cb.dataset.specialties    || "",
                headquarter:   cb.dataset.headquarter    || "",
                location:      cb.dataset.location       || "",
                company_market:cb.dataset.company_market || ""
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
            const selectedCompanies = collectSelectedCompanies();
            if (!selectedCompanies.length) {
                showMessage("Please select at least one company.", "error");
                return;
            }

            const payload = { list_type: activeListMode, companies: selectedCompanies };

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

                const response = await fetch(SAVE_COMPANIES_TO_LIST_URL, {
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

    // ── Profile Drawer Logic ──
    const companyDrawer = document.getElementById("companyDrawer");
    const companyDrawerOverlay = document.getElementById("companyDrawerOverlay");
    const closeCompanyDrawer = document.getElementById("closeCompanyDrawer");
    const companyDrawerContent = document.getElementById("companyDrawerContent");
    const drawerViewEmployeesBtn = document.getElementById("drawerViewEmployeesBtn");
    const drawerSaveToListBtn = document.getElementById("drawerSaveToListBtn");
    const viewEmployeesForm = document.getElementById("viewEmployeesForm");
    const viewEmpCompany = document.getElementById("viewEmpCompany");
    const viewEmpLocation = document.getElementById("viewEmpLocation");

    // Track which table row index the open drawer belongs to (1-based)
    let openDrawerRowIndex = null;

    function openCompanyDrawer() {
        if (!companyDrawer || !companyDrawerOverlay) return;
        companyDrawer.classList.add("open");
        companyDrawerOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeCompanyDrawerFn() {
        if (!companyDrawer || !companyDrawerOverlay) return;
        companyDrawer.classList.remove("open");
        companyDrawerOverlay.classList.remove("active");
        document.body.style.overflow = "";
        openDrawerRowIndex = null;
    }

    if (closeCompanyDrawer) {
        closeCompanyDrawer.addEventListener("click", closeCompanyDrawerFn);
    }
    if (companyDrawerOverlay) {
        companyDrawerOverlay.addEventListener("click", closeCompanyDrawerFn);
    }

    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && companyDrawer && companyDrawer.classList.contains("open")) {
            closeCompanyDrawerFn();
        }
    });

    // ── View Employees: submit hidden form to search_people ──
    if (drawerViewEmployeesBtn) {
        drawerViewEmployeesBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (viewEmployeesForm) {
                viewEmployeesForm.submit();
            }
        });
    }

    // ── Drawer Save to List: select row & open modal ──
    if (drawerSaveToListBtn) {
        drawerSaveToListBtn.addEventListener("click", async function () {
            if (openDrawerRowIndex !== null) {
                // Deselect all rows first
                document.querySelectorAll(".row-checkbox").forEach(cb => cb.checked = false);
                const selectAll = document.getElementById("selectAllRows");
                if (selectAll) selectAll.checked = false;

                // Select the row that matches the open drawer
                const row = document.getElementById("company-card-" + openDrawerRowIndex);
                if (row) {
                    const cb = row.querySelector(".row-checkbox");
                    if (cb) cb.checked = true;
                }

                updateSelectionUI();
            }
            await loadExistingLists();
            setTab("new");
            openModal();
        });
    }

    document.addEventListener("click", function (e) {
        const descToggle = e.target.closest(".drawer-desc-toggle");
        if (descToggle) {
            const descContent = descToggle.previousElementSibling;
            if (descContent) {
                const icon = descToggle.querySelector("i");
                const text = descToggle.querySelector(".toggle-text");
                const isExpanded = (descContent.style.webkitLineClamp === "unset");
                
                if (isExpanded) {
                    descContent.style.webkitLineClamp = "3";
                    descContent.style.lineClamp = "3";
                    if (icon) icon.style.transform = "rotate(0deg)";
                    if (text) text.textContent = "Read More";
                } else {
                    descContent.style.webkitLineClamp = "unset";
                    descContent.style.lineClamp = "unset";
                    if (icon) icon.style.transform = "rotate(180deg)";
                    if (text) text.textContent = "Read Less";
                }
            }
        }

        // ── Handle "View All Employees" link inside drawer content ──
        const viewAllLink = e.target.closest(".drawer-view-employees-link");
        if (viewAllLink) {
            e.preventDefault();
            const cName = viewAllLink.dataset.company || "";
            const cLoc  = viewAllLink.dataset.location || "";
            if (viewEmpCompany) viewEmpCompany.value = cName;
            if (viewEmpLocation) viewEmpLocation.value = cLoc;
            if (viewEmployeesForm) viewEmployeesForm.submit();
            return;
        }

        const trigger = e.target.closest(".drawer-trigger");
        if (trigger) {
            const tr = trigger.closest("tr");
            if (tr) {
                const idStr = tr.id; // e.g. company-card-1
                if (idStr && idStr.startsWith("company-card-")) {
                    const idx = idStr.replace("company-card-", "");
                    const tpl = document.getElementById("company-profile-" + idx);
                    if (tpl && companyDrawerContent) {
                        companyDrawerContent.innerHTML = tpl.innerHTML;
                        
                        // Check if description actually overflows 3 lines
                        const dContent = companyDrawerContent.querySelector(".drawer-desc-content");
                        const dToggle = companyDrawerContent.querySelector(".drawer-desc-toggle");
                        if (dContent && dToggle) {
                            if (dContent.scrollHeight <= dContent.clientHeight) {
                                dToggle.style.display = "none";
                            }
                        }

                        // Store row index for Save to List
                        openDrawerRowIndex = idx;

                        // Update "View Employees" button with company name & location
                        // Pull data from the row's checkbox dataset
                        const cb = tr.querySelector(".row-checkbox");
                        const companyName = cb ? (cb.dataset.name || "") : "";
                        const companyHQ   = cb ? (cb.dataset.headquarter || "") : "";

                        if (viewEmpCompany) viewEmpCompany.value = companyName;
                        if (viewEmpLocation) viewEmpLocation.value = companyHQ;

                        openCompanyDrawer();
                    }
                }
            }
        }
    });

    // ── Init ──
    setTab("new");
    updateSelectionUI();
});