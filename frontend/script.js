/**
 * Legalease App Logic
 * Handles themes, file uploads, data fetching, dynamic UI rendering, charts, and chat.
 */

window.LegaleaseApp = (() => {

    // --- STATE ---
    let contractData = null;
    let currentFilter = 'all';
    let currentSearch = '';
    let riskChartInstance = null;
    let clauseRiskChartInstance = null;
    let isDarkMode = false;
    let loadedFileName = 'contract.pdf';

    // --- THEME MANAGEMENT ---
    const initTheme = () => {
        const toggleBtn = document.getElementById('theme-toggle');
        if (!toggleBtn) return;

        // Check local storage or system preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            toggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            isDarkMode = true;
        }

        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            isDarkMode = document.body.classList.contains('dark-mode');
            
            if (isDarkMode) {
                toggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
                localStorage.setItem('theme', 'dark');
            } else {
                toggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
                localStorage.setItem('theme', 'light');
            }
            
            // Update chart theme if it exists
            if (riskChartInstance) {
                updateChartTheme();
            }
            if (clauseRiskChartInstance) {
                updateClauseChartTheme();
            }
        });
    };

    // --- UPLOAD PAGE LOGIC ---
    const initUpload = () => {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const fileDetails = document.getElementById('file-details');
        const fileName = document.getElementById('file-name');
        const removeFileBtn = document.getElementById('remove-file');
        const analyzeBtn = document.getElementById('analyze-btn');
        const loadingState = document.getElementById('loading-state');
        
        let selectedFile = null;

        if (!dropZone) return; // Not on upload page

        // Drag & Drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            let dt = e.dataTransfer;
            let files = dt.files;
            handleFiles(files);
        });

        fileInput.addEventListener('change', function() {
            handleFiles(this.files);
        });

        function handleFiles(files) {
            if (files.length > 0) {
                selectedFile = files[0];
                if(selectedFile.type !== "application/pdf") {
                    alert("Please upload a PDF file.");
                    return;
                }
                fileName.textContent = selectedFile.name;
                dropZone.classList.add('hidden');
                fileDetails.classList.remove('hidden');
            }
        }

        removeFileBtn.addEventListener('click', () => {
            selectedFile = null;
            fileInput.value = "";
            fileDetails.classList.add('hidden');
            dropZone.classList.remove('hidden');
        });

        analyzeBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            // Show loading state
            fileDetails.classList.add('hidden');
            dropZone.classList.add('hidden');
            loadingState.classList.remove('hidden');

            // Store filename for dashboard
            localStorage.setItem('legalease_filename', selectedFile.name);

            // REAL API INTEGRATION
            const formData = new FormData();
            formData.append('file', selectedFile);

            const fetchPromise = fetch('http://127.0.0.1:8000/analyze_contract', {
                method: 'POST',
                body: formData
            });

            // Start animation tracking the fetchPromise
            await animateProgressUntilDone(fetchPromise);
        });

        async function animateProgressUntilDone(fetchPromise) {
            const steps = [
                document.getElementById('step-1'),
                document.getElementById('step-2'),
                document.getElementById('step-3'),
                document.getElementById('step-4')
            ];

            const delay = ms => new Promise(res => setTimeout(res, ms));

            // Reset steps
            steps.forEach(s => {
                s.classList.remove('active', 'completed');
                s.querySelector('i').className = "fa-solid fa-circle";
            });

            // Step 1: Reading PDF
            steps[0].classList.add('active');
            await delay(500);
            steps[0].classList.replace('active', 'completed');
            steps[0].querySelector('i').className = "fa-solid fa-circle-check";

            // Step 2: Masking sensitive data
            steps[1].classList.add('active');
            await delay(800);
            steps[1].classList.replace('active', 'completed');
            steps[1].querySelector('i').className = "fa-solid fa-circle-check";

            // Step 3: Splitting clauses
            steps[2].classList.add('active');
            await delay(500);
            steps[2].classList.replace('active', 'completed');
            steps[2].querySelector('i').className = "fa-solid fa-circle-check";

            // Step 4: Analyzing contract (Wait for fetchPromise)
            steps[3].classList.add('active');
            
            try {
                const response = await fetchPromise;
                if(!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const resultData = await response.json();
                
                // Save data to localStorage to pass to dashboard
                localStorage.setItem('legalease_analysis_result', JSON.stringify(resultData));
                
                steps[3].classList.replace('active', 'completed');
                steps[3].querySelector('i').className = "fa-solid fa-circle-check";
                
                await delay(500);
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                console.error("API Call failed:", error);
                
                steps[3].classList.remove('active');
                steps[3].querySelector('span').textContent = "Analysis Failed. Using Demo Data.";
                steps[3].querySelector('i').className = "fa-solid fa-circle-xmark";
                steps[3].querySelector('i').style.color = "var(--risk-high)";
                
                await delay(2000);
                
                // For demonstration purposes, if backend is offline, we'll provide mock data
                const mockData = generateMockData();
                localStorage.setItem('legalease_analysis_result', JSON.stringify(mockData));
                window.location.href = 'dashboard.html';
            }
        }
    };

    // --- DASHBOARD LOGIC ---
    const initDashboard = () => {
        const container = document.getElementById('clauses-container');
        if (!container) return; // Not on dashboard

        // 1. Load Data
        const rawData = localStorage.getItem('legalease_analysis_result');
        const savedFileName = localStorage.getItem('legalease_filename');
        
        if(savedFileName) {
            document.getElementById('dashboard-file-name').textContent = savedFileName;
            loadedFileName = savedFileName;
        }

        if (rawData) {
            try {
                contractData = JSON.parse(rawData);
            } catch(e) {
                console.error("Failed to parse localized data", e);
                contractData = generateMockData();
            }
        } else {
            // Redirect back if accessed directly without data
            window.location.href = 'index.html';
            return;
        }

        // 2. Render UI
        updateSummaryStats();
        renderClauseRiskChart();
        renderChart();
        renderClauses();
        setupFilters();
        setupSearch();
        setupChat();
        setupExports();
    };

    const renderClauseRiskChart = () => {
        const ctx = document.getElementById('clauseRiskChart');
        if (!ctx) return;

        const clauses = getFilteredClauses();
        
        // Prepare labels (X-axis) - use actual clause_id to maintain consistency when filtered
        const labels = clauses.map((c, i) => `Clause ${c.clause_id || (i + 1)}`);
        
        // Prepare datasets
        const highData = [];
        const mediumData = [];
        const lowData = [];

        // Y-Axis mapping: Use risk_score (0-100), fallback to default maps if missing
        clauses.forEach(c => {
            const risk = c.risk_level.toUpperCase();
            
            // Allow fallback scoring if backend is outdated or using old cached data
            let score = c.risk_score;
            if (score === undefined || score === null) {
                if (risk === 'HIGH') score = 90;
                else if (risk === 'MEDIUM') score = 50;
                else score = 15;
            }

            if (risk === 'HIGH') {
                highData.push(score);
                mediumData.push(null);
                lowData.push(null);
            } else if (risk === 'MEDIUM') {
                highData.push(null);
                mediumData.push(score);
                lowData.push(null);
            } else {
                highData.push(null);
                mediumData.push(null);
                lowData.push(score);
            }
        });

        const textColor = isDarkMode ? '#f9fafb' : '#111827';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        if (clauseRiskChartInstance) {
            clauseRiskChartInstance.destroy();
        }

        clauseRiskChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'High Risk',
                        data: highData,
                        backgroundColor: '#EF4444', // Red
                        borderRadius: 4
                    },
                    {
                        label: 'Medium Risk',
                        data: mediumData,
                        backgroundColor: '#F59E0B', // Orange
                        borderRadius: 4
                    },
                    {
                        label: 'Low Risk',
                        data: lowData,
                        backgroundColor: '#10B981', // Green
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: textColor, font: { family: "'Inter', sans-serif" } },
                        grid: { color: gridColor, drawBorder: false }
                    },
                    y: {
                        stacked: false, // Turn off stacking so individual heights are precise
                        min: 0,
                        max: 100,
                        ticks: {
                            color: textColor,
                            font: { family: "'Inter', sans-serif" },
                            stepSize: 20
                        },
                        grid: { color: gridColor, drawBorder: false },
                        title: {
                            display: true,
                            text: 'Risk Score (0-100)',
                            color: textColor,
                            font: { family: "'Inter', sans-serif", size: 12 }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor, padding: 20, font: { family: "'Inter', sans-serif" } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw;
                                return ` Score: ${val}/100`;
                            }
                        }
                    }
                }
            }
        });
    };

    const updateSummaryStats = () => {
        if(!contractData || !contractData.analysis) return;

        const clauses = contractData.analysis;
        const total = contractData.total_clauses || clauses.length;
        let high = 0, medium = 0, low = 0;

        clauses.forEach(c => {
            if (c.risk_level.toUpperCase() === 'HIGH') high++;
            else if (c.risk_level.toUpperCase() === 'MEDIUM') medium++;
            else low++;
        });

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-high').textContent = high;
        document.getElementById('stat-medium').textContent = medium;
        document.getElementById('stat-low').textContent = low;
        
        // Show overall risk badge if high risk > 0
        if(high > 0) {
            const riskBadge = document.getElementById('overall-risk-badge');
            if(riskBadge) riskBadge.classList.remove('hidden');
        }
    };

    const getFilteredClauses = () => {
        if(!contractData || !contractData.analysis) return [];
        let filtered = contractData.analysis;

        // Apply Status Filter
        if (currentFilter !== 'all') {
            if (currentFilter === 'illegal') {
                filtered = filtered.filter(c => c.illegal === true);
            } else {
                filtered = filtered.filter(c => c.risk_level.toUpperCase() === currentFilter);
            }
        }

        // Apply Search Filter
        if (currentSearch.trim() !== '') {
            const query = currentSearch.toLowerCase();
            filtered = filtered.filter(c => 
                c.clause_text.toLowerCase().includes(query) || 
                c.reason.toLowerCase().includes(query)
            );
        }
        
        return filtered;
    };

    const renderClauses = () => {
        const container = document.getElementById('clauses-container');
        container.innerHTML = '';

        const filtered = getFilteredClauses();

        if (filtered.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted);">No clauses match the current filters.</div>`;
            return;
        }

        filtered.forEach((clause, index) => {
            const riskClass = `risk-${clause.risk_level.toLowerCase()}`;
            const badgeClass = `badge-${clause.risk_level.toLowerCase()}`;
            
            let riskLabelText = `${clause.risk_level} RISK`;
            if (clause.risk_level.toUpperCase() === 'LOW') {
                riskLabelText += ' ✅';
            } else if (clause.risk_level.toUpperCase() === 'HIGH') {
                riskLabelText += ' ⚠️';
            }
            
            let illegalBadge = clause.illegal ? `<span class="badge-risk badge-illegal">ILLEGAL</span>` : '';
            
            let lawRefHTML = '';
            if (clause.law_reference && clause.law_reference.trim() !== '') {
                lawRefHTML = `
                <div class="law-reference">
                    <i class="fa-solid fa-scale-balanced" style="color:var(--text-muted); margin-top:0.25rem;"></i>
                    <div>
                        <strong>Law Reference/Precedent:</strong><br>
                        ${clause.law_reference}
                    </div>
                </div>`;
            }

            const headerId = `clause-header-${clause.clause_id || index}`;
            const bodyId = `clause-body-${clause.clause_id || index}`;

            const cardHTML = `
            <div class="clause-card ${riskClass}">
                <div class="clause-header" id="${headerId}" onclick="document.getElementById('${bodyId}').classList.toggle('hidden'); this.querySelector('.fa-chevron-down').classList.toggle('fa-rotate-180')">
                    <div class="clause-title">
                        <h4>Clause ${clause.clause_id || (index+1)}</h4>
                        <div class="clause-actions">
                            <span class="badge-risk ${badgeClass}">${riskLabelText}</span>
                            ${illegalBadge}
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-down" style="color:var(--text-muted); transition: transform 0.3s;"></i>
                </div>
                
                <div class="clause-body" id="${bodyId}">
                    <div class="clause-text">
                        "${clause.clause_text}"
                    </div>
                    
                    <div class="reason-box">
                        <div class="reason-title">
                            <i class="fa-solid fa-clipboard-question" style="color:var(--primary-color);"></i> AI Analysis
                        </div>
                        <p>${clause.reason}</p>
                    </div>
                    
                    ${lawRefHTML}
                    
                    <div style="margin-top: 1rem; display: flex; justify-content: flex-end;">
                        <button class="btn btn-outline" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;" onclick="navigator.clipboard.writeText('${clause.clause_text.replace(/'/g, "\\'")}')">
                            <i class="fa-solid fa-copy"></i> Copy Text
                        </button>
                    </div>
                </div>
            </div>`;
            
            container.insertAdjacentHTML('beforeend', cardHTML);
        });
    };

    const setupFilters = () => {
        const btns = document.querySelectorAll('.filter-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                btns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentFilter = e.target.getAttribute('data-filter');
                renderClauses();
                renderClauseRiskChart(); // update the 2D bar chart
            });
        });
    };

    const setupSearch = () => {
        const searchInput = document.getElementById('search-input');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearch = e.target.value;
                renderClauses();
                renderClauseRiskChart(); // update the 2D bar chart
            });
        }
    };

    // --- CHART LOGIC ---
    const renderChart = () => {
        const ctx = document.getElementById('riskChart');
        if (!ctx || !contractData) return;

        let high = 0, medium = 0, low = 0;
        contractData.analysis.forEach(c => {
            if (c.risk_level.toUpperCase() === 'HIGH') high++;
            else if (c.risk_level.toUpperCase() === 'MEDIUM') medium++;
            else low++;
        });

        const textColor = isDarkMode ? '#f9fafb' : '#111827';
        
        if (riskChartInstance) {
            riskChartInstance.destroy();
        }

        riskChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['High Risk', 'Medium Risk', 'Low Risk'],
                datasets: [{
                    data: [high, medium, low],
                    backgroundColor: [
                        '#EF4444', // Red
                        '#F59E0B', // Orange
                        '#10B981'  // Green
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            padding: 20,
                            font: {
                                family: "'Inter', sans-serif"
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    };

    const updateChartTheme = () => {
        const textColor = isDarkMode ? '#f9fafb' : '#111827';
        
        if(riskChartInstance) {
            riskChartInstance.options.plugins.legend.labels.color = textColor;
            riskChartInstance.update();
        }
    };

    const updateClauseChartTheme = () => {
        const textColor = isDarkMode ? '#f9fafb' : '#111827';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        
        if(clauseRiskChartInstance) {
            clauseRiskChartInstance.options.scales.x.ticks.color = textColor;
            clauseRiskChartInstance.options.scales.x.grid.color = gridColor;
            clauseRiskChartInstance.options.scales.y.ticks.color = textColor;
            clauseRiskChartInstance.options.scales.y.grid.color = gridColor;
            clauseRiskChartInstance.options.plugins.legend.labels.color = textColor;
            clauseRiskChartInstance.update();
        }
    };

    // --- CHAT LOGIC ---
    const setupChat = () => {
        const input = document.getElementById('chat-input-field');
        const sendBtn = document.getElementById('chat-send-btn');
        const messagesContainer = document.getElementById('chat-messages');

        if(!input || !sendBtn) return;

        const sendMessage = async () => {
            const text = input.value.trim();
            if(!text) return;

            // 1. Add User Message
            appendMessage(text, 'user-message');
            input.value = '';

            // 2. Add Typing Indicator
            const typingId = 'typing-' + Date.now();
            const typingDiv = document.createElement('div');
            typingDiv.id = typingId;
            typingDiv.className = 'typing-indicator';
            typingDiv.innerHTML = '<span></span><span></span><span></span>';
            messagesContainer.appendChild(typingDiv);
            scrollToBottom();

            // 3. Call API
            try {
                const response = await fetch('http://127.0.0.1:8000/ask_question', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        question: text,
                        // Optionally pass analysis data so backend knows context
                        contract_context: contractData 
                    })
                });

                document.getElementById(typingId).remove();

                if(response.ok) {
                    const data = await response.json();
                    appendMessage(data.answer || "Processing complete.", 'bot-message');
                } else {
                    // MOCK fallback for demonstration
                    setTimeout(() => {
                        const mockAnswer = generateMockChatResponse(text);
                        appendMessage(mockAnswer, 'bot-message');
                    }, 800);
                }

            } catch (error) {
                console.log("Chat API error:", error);
                document.getElementById(typingId).remove();
                
                // MOCK fallback for demonstration
                setTimeout(() => {
                    const mockAnswer = generateMockChatResponse(text);
                    appendMessage(mockAnswer, 'bot-message');
                }, 800);
            }
        };

        input.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') sendMessage();
        });

        sendBtn.addEventListener('click', sendMessage);

        function appendMessage(text, className) {
            const div = document.createElement('div');
            div.className = `message ${className}`;
            
            if (className === 'bot-message' && typeof marked !== 'undefined') {
                div.innerHTML = marked.parse(text);
            } else {
                div.textContent = text;
            }
            
            messagesContainer.appendChild(div);
            scrollToBottom();
        }

        function scrollToBottom() {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    };

    // --- EXPORTS ---
    const setupExports = () => {
        const btnJson = document.getElementById('export-json-btn');
        if(btnJson) {
            btnJson.addEventListener('click', () => {
                if(!contractData) return;
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(contractData, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href",     dataStr);
                downloadAnchorNode.setAttribute("download", `legalease_report_${loadedFileName.replace('.pdf', '')}.json`);
                document.body.appendChild(downloadAnchorNode); // required for firefox
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            });
        }
        
        const btnPdf = document.getElementById('export-pdf-btn');
        if(btnPdf) {
            btnPdf.addEventListener('click', () => {
                // Expanding all clauses before print so they appear in the PDF
                document.querySelectorAll('.clause-body').forEach(el => el.classList.remove('hidden'));
                document.querySelectorAll('.fa-chevron-down').forEach(el => el.classList.remove('fa-rotate-180'));
                
                // Small delay to ensure DOM updates before print dialog opens
                setTimeout(() => {
                    window.print();
                }, 100);
            });
        }
    };

    // --- MOCK DATA GENERATOR (For presentation without backend) ---
    const generateMockData = () => {
        return {
            "total_clauses": 4,
            "analysis": [
                {
                    "clause_id": 1,
                    "clause_text": "The Rent shall be paid on or before the 5th of every month. If delayed, a penalty of 5% per day will be levied.",
                    "risk_level": "HIGH",
                    "risk_score": 95,
                    "reason": "A penalty of 5% per day equates to approximately 150% monthly interest, which is highly unconscionable and legally unenforceable under standard usury laws and the relevant Contracts Act.",
                    "illegal": true,
                    "law_reference": "Section 74 of the Indian Contract Act, 1872 (Penalties in contracts)."
                },
                {
                    "clause_id": 2,
                    "clause_text": "The Landlord reserves the right to enter the premises at any time without prior notice to the Tenant.",
                    "risk_level": "HIGH",
                    "risk_score": 82,
                    "reason": "This violates the tenant's fundamental right to privacy and peaceful possession. The landlord must provide reasonable prior notice (typically 24 hours) before entering.",
                    "illegal": false,
                    "law_reference": "Standard Rent Control Acts and implicit covenant of quiet enjoyment."
                },
                {
                    "clause_id": 3,
                    "clause_text": "The tenant is responsible for minor repairs under Rs. 500, while major repairs will be handled by the landlord.",
                    "risk_level": "LOW",
                    "risk_score": 12,
                    "reason": "This is a standard and reasonable division of maintenance responsibilities typical in fair lease agreements.",
                    "illegal": false,
                    "law_reference": ""
                },
                {
                    "clause_id": 4,
                    "clause_text": "In the event of early termination by the tenant, the security deposit shall be entirely forfeit regardless of the reason.",
                    "risk_level": "MEDIUM",
                    "risk_score": 60,
                    "reason": "While landlords can deduct actual damages, a blanket forfeiture clause without proving actual loss may be struck down as a penalty clause by courts.",
                    "illegal": false,
                    "law_reference": "Section 74 of the Contract Act - Liquidated damages must represent a genuine pre-estimate of loss."
                }
            ]
        };
    };

    const generateMockChatResponse = (question) => {
        const q = question.toLowerCase();
        if(q.includes("terminate") || q.includes("early")) {
            return "According to Clause 4, if you terminate early, the contract claims the entire security deposit will be forfeit. However, legally, courts often view such blanket forfeitures as penalties rather than genuine damages, so it may not be entirely enforceable.";
        }
        if(q.includes("risk") || q.includes("highest")) {
            return "The highest risks are: 1) The 5% per day late fee penalty in Clause 1 (which is likely illegal) and 2) The landlord's right to enter without notice in Clause 2 (which violates privacy rights).";
        }
        return `Based on the contract analysis, your question touches on aspects of the legal obligations defined within. The current clauses indicate 2 HIGH risk items and 1 MEDIUM risk item that you should review carefully.`;
    };

    // Initialization
    const init = () => {
        initTheme();
        initUpload();
    };

    return {
        init,
        initDashboard
    };

})();

// Initialize base app on DOM load
document.addEventListener('DOMContentLoaded', window.LegaleaseApp.init);
