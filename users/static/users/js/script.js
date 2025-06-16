class EmailMarketingApp {
  constructor() {
    this.currentStep = 1
    this.totalSteps = 3
    this.formData = {}
    this.generatedEmails = []
    this.selectedEmails = []

    this.init()
  }

  init() {
    this.bindEvents()
    this.updateStepDisplay()
  }

  bindEvents() {
    // Navigation buttons
    document.getElementById("nextBtn").addEventListener("click", () => this.nextStep())
    document.getElementById("prevBtn").addEventListener("click", () => this.prevStep())

    // Step navigation from sidebar
    document.querySelectorAll(".step").forEach((step) => {
      step.addEventListener("click", (e) => {
        const stepNumber = Number.parseInt(e.currentTarget.dataset.step)
        this.goToStep(stepNumber)
      })
    })

    // Generate emails button
    document.getElementById("generateEmails").addEventListener("click", () => this.generateEmails())

    // Form submissions
//    document.getElementById("basicInfoForm").addEventListener("submit", (e) => e.preventDefault())
//    document.getElementById("companyDetailsForm").addEventListener("submit", (e) => e.preventDefault())
    document.getElementById("targetFrameworkForm").addEventListener("submit", (e) => e.preventDefault())
  }

  nextStep() {
    if (this.validateCurrentStep()) {
      this.saveCurrentStepData()
      if (this.currentStep < this.totalSteps) {
        this.currentStep++
        this.updateStepDisplay()
      }
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--
      this.updateStepDisplay()
    }
  }

  goToStep(stepNumber) {
    if (stepNumber <= this.currentStep || this.isStepCompleted(stepNumber - 1)) {
      this.currentStep = stepNumber
      this.updateStepDisplay()
    }
  }

  updateStepDisplay() {
    // Update step content visibility
    document.querySelectorAll(".step-content").forEach((content) => {
      content.classList.remove("active")
    })
    document.getElementById(`step-${this.currentStep}`).classList.add("active")

    // Update sidebar steps
    document.querySelectorAll(".step").forEach((step, index) => {
      step.classList.remove("active", "completed")
      if (index + 1 === this.currentStep) {
        step.classList.add("active")
      } else if (index + 1 < this.currentStep) {
        step.classList.add("completed")
      }
    })

    // Update navigation buttons
    const prevBtn = document.getElementById("prevBtn")
    const nextBtn = document.getElementById("nextBtn")

    prevBtn.style.display = this.currentStep === 1 ? "none" : "inline-block"

    if (this.currentStep === this.totalSteps) {
      nextBtn.style.display = "none"
    } else {
      nextBtn.style.display = "inline-block"
      nextBtn.innerHTML =
        this.currentStep === 4
          ? 'Generate & Review<i class="fas fa-arrow-right ms-2"></i>'
          : 'Next<i class="fas fa-arrow-right ms-2"></i>'
    }
  }

  validateCurrentStep() {
    const currentStepElement = document.getElementById(`step-${this.currentStep}`)
    const requiredFields = currentStepElement.querySelectorAll("[required]")
    let isValid = true

    requiredFields.forEach((field) => {
      if (!field.value.trim()) {
        field.classList.add("is-invalid")
        isValid = false
      } else {
        field.classList.remove("is-invalid")
      }
    })

    if (!isValid) {
      this.showAlert("Please fill in all required fields.", "warning")
    }

    return isValid
  }

  saveCurrentStepData() {
    const currentStepElement = document.getElementById(`step-${this.currentStep}`)
    const formElements = currentStepElement.querySelectorAll("input, select, textarea")

    formElements.forEach((element) => {
      if (element.type === "radio") {
        if (element.checked) {
          this.formData[element.name] = element.value
        }
      } else if (element.type === "file") {
        this.formData[element.id] = element.files
      } else {
        this.formData[element.id] = element.value
      }
    })
  }

  isStepCompleted(stepNumber) {
    // Logic to check if a step has been completed
    return stepNumber < this.currentStep
  }

  async generateEmails() {
    this.showLoading(true)

    try {
      // Simulate API call to generate emails
      await this.simulateEmailGeneration()
      this.displayGeneratedEmails()
      this.setupSendCampaign()
      this.showAlert("Emails generated successfully!", "success")
    } catch (error) {
      this.showAlert("Error generating emails. Please try again.", "danger")
    } finally {
      this.showLoading(false)
    }
  }

  async simulateEmailGeneration() {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const framework = this.formData.framework || "aida"
    const templates = this.getEmailTemplates(framework)

    this.generatedEmails = templates.map((template, index) => ({
      id: index + 1,
      title: template.title,
      subject: this.personalizeText(template.subject),
      body: this.personalizeText(template.body),
      framework: framework,
      selected: false,
    }))
  }

  getEmailTemplates(framework) {
    const templates = {
      aida: [
        {
          title: "AIDA - Direct Approach",
          subject: "Quick question about {{targetCompanyName}}'s {{industry}} strategy",
          body: `Hi {{targetPersonName}},

I noticed {{targetCompanyName}} has been making impressive strides in the {{industry}} space. Your recent work caught my attention.

At {{companyName}}, we've helped similar companies like yours achieve remarkable results through our {{valueProposition}}. 

I'd love to show you how we could potentially help {{targetCompanyName}} achieve even greater success. Would you be open to a brief 15-minute conversation this week?

Best regards,
{{senderName}}
{{companyName}}`,
        },
        {
          title: "AIDA - Problem-Focused",
          subject: "Solving {{industry}} challenges at {{targetCompanyName}}",
          body: `Hello {{targetPersonName}},

Many {{industry}} leaders are struggling with efficiency and growth challenges in today's market.

I've been following {{targetCompanyName}}'s journey and believe our solution at {{companyName}} could be a perfect fit. We specialize in {{valueProposition}} and have helped companies achieve significant improvements.

I'd be happy to share a quick case study relevant to your industry. Are you available for a brief call to discuss how this could benefit {{targetCompanyName}}?

Looking forward to connecting,
{{senderName}}`,
        },
        {
          title: "AIDA - Value Proposition",
          subject: "Increase {{targetCompanyName}}'s efficiency by 40%",
          body: `Hi {{targetPersonName}},

What if I told you that {{targetCompanyName}} could increase efficiency by 40% in the next quarter?

Our clients in the {{industry}} sector have seen exactly these results using our proven methodology. {{companyName}} specializes in {{valueProposition}}, and I believe we could deliver similar outcomes for you.

I'd love to schedule a quick demo to show you exactly how this works. Would next Tuesday or Wednesday work better for a 20-minute call?

Best,
{{senderName}}
{{companyName}}`,
        },
        {
          title: "AIDA - Social Proof",
          subject: "How [Similar Company] achieved 200% growth",
          body: `Dear {{targetPersonName}},

I hope this email finds you well. I wanted to reach out because of {{targetCompanyName}}'s reputation in the {{industry}} industry.

We recently helped a company similar to yours achieve 200% growth using our {{valueProposition}}. The results were so impressive that I thought you might be interested in learning more.

{{companyName}} has a track record of helping {{industry}} companies overcome their biggest challenges and achieve breakthrough results.

Would you be interested in a brief conversation about how we might be able to help {{targetCompanyName}} achieve similar success?

Warm regards,
{{senderName}}`,
        },
        {
          title: "AIDA - Curiosity Hook",
          subject: "The secret {{industry}} leaders don't want you to know",
          body: `Hi {{targetPersonName}},

There's a strategy that top {{industry}} companies are using to stay ahead of the competition, but most businesses don't know about it.

I've been studying {{targetCompanyName}} and your approach to {{industry}}, and I believe this strategy could be a game-changer for you.

At {{companyName}}, we've helped implement this approach with remarkable results. Our {{valueProposition}} has consistently delivered outstanding outcomes.

I'd love to share this strategy with you in a quick 15-minute call. When would be a good time to connect?

Best regards,
{{senderName}}`,
        },
      ],
      pas: [
        {
          title: "PAS - Efficiency Problem",
          subject: "Is inefficiency costing {{targetCompanyName}} money?",
          body: `Hi {{targetPersonName}},

Many {{industry}} companies are losing thousands of dollars monthly due to inefficient processes and outdated systems.

This problem only gets worse over time, leading to frustrated teams, missed opportunities, and declining competitive advantage. The longer you wait, the more it costs.

That's exactly why we created {{companyName}}. Our {{valueProposition}} has helped companies like yours eliminate these inefficiencies and boost profitability.

Would you like to see how we could solve this for {{targetCompanyName}}?

Best,
{{senderName}}`,
        },
        {
          title: "PAS - Growth Challenges",
          subject: "Why {{targetCompanyName}}'s growth might be stalling",
          body: `Hello {{targetPersonName}},

Most {{industry}} companies hit a growth plateau around your stage, struggling to scale effectively while maintaining quality.

This stagnation can be frustrating and costly. Teams become overwhelmed, customer satisfaction drops, and competitors start gaining ground. Without the right solution, this cycle continues indefinitely.

{{companyName}} specializes in breaking through these growth barriers. Our {{valueProposition}} has helped numerous companies overcome these exact challenges and achieve sustainable growth.

I'd love to show you how we can help {{targetCompanyName}} break through to the next level. Are you available for a brief call this week?

Regards,
{{senderName}}`,
        },
      ],
      "before-after": [
        {
          title: "Before-After-Bridge - Transformation",
          subject: "Transform {{targetCompanyName}}'s {{industry}} operations",
          body: `Hi {{targetPersonName}},

Before: Most {{industry}} companies struggle with inefficient processes, high costs, and limited scalability.

After: Imagine {{targetCompanyName}} operating with streamlined processes, reduced costs, and unlimited growth potential.

Bridge: {{companyName}}'s {{valueProposition}} is the solution that makes this transformation possible. We've helped companies achieve this exact transformation.

Would you like to learn how we can help {{targetCompanyName}} make this transition?

Best regards,
{{senderName}}`,
        },
      ],
      star: [
        {
          title: "STAR - Success Story",
          subject: "How we helped [Company] achieve 300% ROI",
          body: `Hi {{targetPersonName}},

Situation: A {{industry}} company similar to {{targetCompanyName}} was struggling with efficiency and growth challenges.

Task: They needed to streamline operations while scaling their business effectively.

Action: We implemented our {{valueProposition}} solution, providing comprehensive support throughout the process.

Result: They achieved 300% ROI within 6 months and continue to see sustained growth.

I believe {{companyName}} could deliver similar results for {{targetCompanyName}}. Would you be interested in learning more?

Best,
{{senderName}}`,
        },
      ],
    }

    return templates[framework] || templates.aida
  }

  personalizeText(text) {
    let personalizedText = text

    // Replace placeholders with actual data
    const replacements = {
      "{{targetCompanyName}}": this.formData.targetCompanyName || "[Target Company]",
      "{{targetPersonName}}": this.formData.targetPersonName || "[Name]",
      "{{targetPersonRole}}": this.formData.targetPersonRole || "[Role]",
      "{{companyName}}": this.formData.companyName || "[Your Company]",
      "{{senderName}}": this.formData.senderName || "[Your Name]",
      "{{industry}}": this.formData.industry || "[Industry]",
      "{{valueProposition}}": this.formData.valueProposition || "[Value Proposition]",
    }

    Object.keys(replacements).forEach((placeholder) => {
      personalizedText = personalizedText.replace(new RegExp(placeholder, "g"), replacements[placeholder])
    })

    return personalizedText
  }

  displayGeneratedEmails() {
    const container = document.getElementById("emailsContainer")
    container.innerHTML = ""

    this.generatedEmails.forEach((email) => {
      const emailCard = this.createEmailCard(email)
      container.appendChild(emailCard)
    })
  }

  createEmailCard(email) {
    const card = document.createElement("div")
    card.className = "email-card"
    card.innerHTML = `
            <div class="email-header">
                <h5 class="email-title">${email.title}</h5>
                <div class="email-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="app.previewEmail(${email.id})">
                        <i class="fas fa-eye"></i> Preview
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="app.editEmail(${email.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <div class="form-check ms-2">
                        <input class="form-check-input" type="checkbox" id="select-${email.id}" 
                               onchange="app.toggleEmailSelection(${email.id})">
                        <label class="form-check-label" for="select-${email.id}">Select</label>
                    </div>
                </div>
            </div>
            <div class="email-body">
                <div class="email-subject">
                    <strong>Subject:</strong> ${email.subject}
                </div>
                <div class="email-content">
                    ${email.body.replace(/\n/g, "<br>")}
                </div>
            </div>
        `
    return card
  }

  previewEmail(emailId) {
    const email = this.generatedEmails.find((e) => e.id === emailId)
    if (email) {
      const modal = new bootstrap.Modal(document.getElementById("emailPreviewModal"))
      document.getElementById("emailPreviewContent").innerHTML = `
                <div class="email-template">
                    <div class="subject-line">Subject: ${email.subject}</div>
                    <div class="email-body">${email.body.replace(/\n/g, "<br>")}</div>
                    <div class="signature">
                        <p>Best regards,<br>
                        ${this.formData.senderName}<br>
                        ${this.formData.companyName}</p>
                    </div>
                </div>
            `
      modal.show()
    }
  }

  editEmail(emailId) {
    const email = this.generatedEmails.find((e) => e.id === emailId)
    if (email) {
      const modal = new bootstrap.Modal(document.getElementById("emailPreviewModal"))
      document.getElementById("emailPreviewContent").innerHTML = `
                <div class="mb-3">
                    <label class="form-label">Subject Line</label>
                    <input type="text" class="form-control" id="editSubject" value="${email.subject}">
                </div>
                <div class="mb-3">
                    <label class="form-label">Email Body</label>
                    <textarea class="form-control" id="editBody" rows="15">${email.body}</textarea>
                </div>
            `

      document.getElementById("saveEmailChanges").onclick = () => {
        email.subject = document.getElementById("editSubject").value
        email.body = document.getElementById("editBody").value
        this.displayGeneratedEmails()
        modal.hide()
        this.showAlert("Email updated successfully!", "success")
      }

      modal.show()
    }
  }

  toggleEmailSelection(emailId) {
    const email = this.generatedEmails.find((e) => e.id === emailId)
    const checkbox = document.getElementById(`select-${emailId}`)
    const card = checkbox.closest(".email-card")

    if (email) {
      email.selected = checkbox.checked
      if (checkbox.checked) {
        card.classList.add("selected")
        this.selectedEmails.push(email)
      } else {
        card.classList.remove("selected")
        this.selectedEmails = this.selectedEmails.filter((e) => e.id !== emailId)
      }
    }
  }

  setupSendCampaign() {
    const sendContainer = document.getElementById("sendCampaignContent")
    sendContainer.innerHTML = `
            <div class="campaign-summary">
                <h5><i class="fas fa-chart-line me-2"></i>Campaign Summary</h5>
                <div class="summary-item">
                    <span>Target Company:</span>
                    <strong>${this.formData.targetCompanyName}</strong>
                </div>
                <div class="summary-item">
                    <span>Target Email:</span>
                    <strong>${this.formData.targetEmail}</strong>
                </div>
                <div class="summary-item">
                    <span>Framework Used:</span>
                    <strong>${this.formData.framework?.toUpperCase()}</strong>
                </div>
                <div class="summary-item">
                    <span>Emails Generated:</span>
                    <strong>${this.generatedEmails.length}</strong>
                </div>
            </div>

            <div class="send-options">
                <div class="send-option" onclick="app.selectSendOption('immediate')">
                    <i class="fas fa-bolt"></i>
                    <h6>Send Immediately</h6>
                    <p class="text-muted">Send selected emails right now</p>
                </div>
                <div class="send-option" onclick="app.selectSendOption('scheduled')">
                    <i class="fas fa-clock"></i>
                    <h6>Schedule Send</h6>
                    <p class="text-muted">Schedule emails for later</p>
                </div>
                <div class="send-option" onclick="app.selectSendOption('sequence')">
                    <i class="fas fa-list-ol"></i>
                    <h6>Email Sequence</h6>
                    <p class="text-muted">Send as a drip campaign</p>
                </div>
            </div>

            <div class="text-center">
                <button class="btn btn-success btn-lg" onclick="app.sendCampaign()" disabled id="sendCampaignBtn">
                    <i class="fas fa-paper-plane me-2"></i>Send Campaign
                </button>
            </div>
        `
  }

  selectSendOption(option) {
    document.querySelectorAll(".send-option").forEach((opt) => opt.classList.remove("selected"))
    event.target.closest(".send-option").classList.add("selected")

    this.selectedSendOption = option
    document.getElementById("sendCampaignBtn").disabled = this.selectedEmails.length === 0
  }

  async sendCampaign() {
    if (this.selectedEmails.length === 0) {
      this.showAlert("Please select at least one email to send.", "warning")
      return
    }

    this.showLoading(true, "Sending your campaign...")

    try {
      // Simulate sending emails
      await new Promise((resolve) => setTimeout(resolve, 2000))

      this.showSuccessState()
      this.showAlert(`Campaign sent successfully! ${this.selectedEmails.length} emails delivered.`, "success")
    } catch (error) {
      this.showAlert("Error sending campaign. Please try again.", "danger")
    } finally {
      this.showLoading(false)
    }
  }

  showSuccessState() {
    const sendContainer = document.getElementById("sendCampaignContent")
    sendContainer.innerHTML = `
            <div class="success-state">
                <i class="fas fa-check-circle"></i>
                <h3>Campaign Sent Successfully!</h3>
                <p class="text-muted">Your emails have been delivered to ${this.formData.targetEmail}</p>
                <div class="mt-4">
                    <button class="btn btn-primary me-2" onclick="app.resetApp()">
                        <i class="fas fa-plus me-2"></i>Create New Campaign
                    </button>
                    <button class="btn btn-outline-primary" onclick="app.viewAnalytics()">
                        <i class="fas fa-chart-bar me-2"></i>View Analytics
                    </button>
                </div>
            </div>
        `
  }

  resetApp() {
    this.currentStep = 1
    this.formData = {}
    this.generatedEmails = []
    this.selectedEmails = []

    // Reset all forms
    document.querySelectorAll("form").forEach((form) => form.reset())

    this.updateStepDisplay()
    this.showAlert("Ready to create a new campaign!", "info")
  }

  viewAnalytics() {
    this.showAlert("Analytics feature coming soon!", "info")
  }

  showLoading(show, message = "Generating your personalized emails...") {
    const overlay = document.getElementById("loadingOverlay")
    if (show) {
      overlay.querySelector("p").textContent = message
      overlay.style.display = "flex"
    } else {
      overlay.style.display = "none"
    }
  }

  showAlert(message, type = "info") {
    // Create and show Bootstrap alert
    const alertDiv = document.createElement("div")
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`
    alertDiv.style.cssText = "top: 20px; right: 20px; z-index: 10000; min-width: 300px;"
    alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `

    document.body.appendChild(alertDiv)

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove()
      }
    }, 5000)
  }
}

// Initialize the app
const app = new EmailMarketingApp()

// Additional utility functions
document.addEventListener("DOMContentLoaded", () => {
  // File upload preview
  document.getElementById("productFiles").addEventListener("change", (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      const fileList = files.map((file) => file.name).join(", ")
      app.showAlert(`Files selected: ${fileList}`, "info")
    }
  })

  // Form validation styling
  document.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("blur", function () {
      if (this.hasAttribute("required") && !this.value.trim()) {
        this.classList.add("is-invalid")
      } else {
        this.classList.remove("is-invalid")
        this.classList.add("is-valid")
      }
    })
  })
})
