(function () {
        // 文件路径
        const PLANS_FILE_PATH = './plans.json';
        const CONFIG_FILE_PATH = './config.json';
        const PLATFORMS_FILE_PATH = './platforms.json';

        // 全局配置
        let appConfig = {};
        window.appConfig = appConfig;
        let watermarkUrl = '';

        // 全局数据
        let allPlans = [];
        let filteredPlans = [];
        let allPlatforms = [];
        let platformSelectedLabels = [];
        let platformShowDiscontinued = false;
        let platformShowRushPurchase = false;
        let currentSort = { column: null, direction: 'asc' };
        // 已确认的选择
        let selectedVendors = new Set();
        let selectedModels = new Set();
        let selectedTypes = new Set();
        let selectedTags = new Set();
        let priceFilters = {
            firstMonth: { min: null, max: null },
            monthly: { min: null, max: null },
            quarterly: { min: null, max: null },
            yearly: { min: null, max: null }
        };

        // 临时选择（下拉框中的操作，只有点确定才提交）
        let tempSelectedVendors = new Set();
        let tempSelectedModels = new Set();
        let tempSelectedTypes = new Set();
        let tempPriceFilters = {
            firstMonth: { min: null, max: null },
            monthly: { min: null, max: null },
            quarterly: { min: null, max: null },
            yearly: { min: null, max: null }
        };

        let requestFilters = {
            fiveHours: { min: null, max: null },
            weekly: { min: null, max: null },
            monthly: { min: null, max: null },
            tokenLimit: { min: null, max: null }
        };

        // 检查价格筛选是否已应用
        function isPriceFilterApplied(priceType) {
            return priceFilters[priceType].min !== null && priceFilters[priceType].max !== null;
        }

        function isRequestFilterApplied(requestType) {
            return requestFilters[requestType].min !== null && requestFilters[requestType].max !== null;
        }
        let activeDropdown = null;

        // DOM 元素
        const typeBtn = document.getElementById('typeBtn');
        const typeDropdown = document.getElementById('typeDropdown');
        const typeCheckboxes = document.getElementById('typeCheckboxes');
        const typeCount = document.getElementById('typeCount');
        const tokenLimitBtn = document.getElementById('tokenLimitBtn');
        const tokenLimitDropdown = document.getElementById('tokenLimitDropdown');
        const tokenLimitCount = document.getElementById('tokenLimitCount');
        const vendorBtn = document.getElementById('vendorBtn');
        const modelBtn = document.getElementById('modelBtn');
        const vendorDropdown = document.getElementById('vendorDropdown');
        const modelDropdown = document.getElementById('modelDropdown');
        const vendorCheckboxes = document.getElementById('vendorCheckboxes');
        const modelCheckboxes = document.getElementById('modelCheckboxes');
        const vendorCount = document.getElementById('vendorCount');
        const modelCount = document.getElementById('modelCount');
        const presetTagButtons = Array.from(document.querySelectorAll('[data-tag-filter]'));
        
        // 首月价格
        const firstMonthPriceBtn = document.getElementById('firstMonthPriceBtn');
        const firstMonthPriceDropdown = document.getElementById('firstMonthPriceDropdown');
        const firstMonthPriceCount = document.getElementById('firstMonthPriceCount');
        const firstMonthSliderMin = document.getElementById('firstMonthSliderMin');
        const firstMonthSliderMax = document.getElementById('firstMonthSliderMax');
        const firstMonthSliderRange = document.getElementById('firstMonthSliderRange');
        const firstMonthMinValue = document.getElementById('firstMonthMinValue');
        const firstMonthMaxValue = document.getElementById('firstMonthMaxValue');
        
        // 包月价格
        const monthlyPriceBtn = document.getElementById('monthlyPriceBtn');
        const monthlyPriceDropdown = document.getElementById('monthlyPriceDropdown');
        const monthlyPriceCount = document.getElementById('monthlyPriceCount');
        const monthlySliderMin = document.getElementById('monthlySliderMin');
        const monthlySliderMax = document.getElementById('monthlySliderMax');
        const monthlySliderRange = document.getElementById('monthlySliderRange');
        const monthlyMinValue = document.getElementById('monthlyMinValue');
        const monthlyMaxValue = document.getElementById('monthlyMaxValue');
        
        // 包季价格
        const quarterlyPriceBtn = document.getElementById('quarterlyPriceBtn');
        const quarterlyPriceDropdown = document.getElementById('quarterlyPriceDropdown');
        const quarterlyPriceCount = document.getElementById('quarterlyPriceCount');
        const quarterlySliderMin = document.getElementById('quarterlySliderMin');
        const quarterlySliderMax = document.getElementById('quarterlySliderMax');
        const quarterlySliderRange = document.getElementById('quarterlySliderRange');
        const quarterlyMinValue = document.getElementById('quarterlyMinValue');
        const quarterlyMaxValue = document.getElementById('quarterlyMaxValue');
        
        // 包年价格
        const yearlyPriceBtn = document.getElementById('yearlyPriceBtn');
        const yearlyPriceDropdown = document.getElementById('yearlyPriceDropdown');
        const yearlyPriceCount = document.getElementById('yearlyPriceCount');
        const yearlySliderMin = document.getElementById('yearlySliderMin');
        const yearlySliderMax = document.getElementById('yearlySliderMax');
        const yearlySliderRange = document.getElementById('yearlySliderRange');
        const yearlyMinValue = document.getElementById('yearlyMinValue');
        const yearlyMaxValue = document.getElementById('yearlyMaxValue');

        // 请求数筛选
        const fiveHoursRequestBtn = document.getElementById('fiveHoursRequestBtn');
        const fiveHoursRequestDropdown = document.getElementById('fiveHoursRequestDropdown');
        const fiveHoursRequestCount = document.getElementById('fiveHoursRequestCount');
        const weeklyRequestBtn = document.getElementById('weeklyRequestBtn');
        const weeklyRequestDropdown = document.getElementById('weeklyRequestDropdown');
        const weeklyRequestCount = document.getElementById('weeklyRequestCount');
        const monthlyRequestBtn = document.getElementById('monthlyRequestBtn');
        const monthlyRequestDropdown = document.getElementById('monthlyRequestDropdown');
        const monthlyRequestCount = document.getElementById('monthlyRequestCount');
        
        const tableBody = document.getElementById('tableBody');
        const showingCount = document.getElementById('showingCount');
        const totalCount = document.getElementById('totalCount');
        const tableScroll = document.getElementById('tableScroll');

        /** 按数据中的出现顺序去重，用于平台下拉等 */
        function uniqueStringsInOrder(strings) {
            const seen = new Set();
            const out = [];
            for (const s of strings) {
                if (s === undefined || s === null) continue;
                if (seen.has(s)) continue;
                seen.add(s);
                out.push(s);
            }
            return out;
        }

        /**
         * 模型筛选下拉：GLM、Kimi、MiniMax、DeepSeek、Qwen、MiMo、Doubao、GPT、Claude、Step 开头的在前
         * （前缀顺序如上；同一前缀内保持 plans 中的出现顺序）；其余按 zh-CN 字典序在后。
         */
        function modelFilterPrefixRank(name) {
            const n = String(name);
            if (n.startsWith('GLM')) return 0;
            if (n.startsWith('Kimi')) return 1;
            if (n.startsWith('MiniMax')) return 2;
            if (n.startsWith('DeepSeek')) return 3;
            if (n.startsWith('Qwen')) return 4;
            if (/^mimo/i.test(n)) return 5;
            if (n.startsWith('Doubao')) return 6;
            if (n.startsWith('GPT')) return 7;
            if (n.startsWith('Claude')) return 8;
            if (/^step/i.test(n)) return 9;
            return -1;
        }

        function sortModelsForFilterDropdown(modelsInDataOrder) {
            const priority = [];
            const rest = [];
            for (const m of modelsInDataOrder) {
                if (modelFilterPrefixRank(m) >= 0) {
                    priority.push(m);
                } else {
                    rest.push(m);
                }
            }
            priority.sort((a, b) => {
                const ra = modelFilterPrefixRank(a);
                const rb = modelFilterPrefixRank(b);
                if (ra !== rb) return ra - rb;
                return modelsInDataOrder.indexOf(a) - modelsInDataOrder.indexOf(b);
            });
            rest.sort((a, b) => a.localeCompare(b, 'zh-CN'));
            return priority.concat(rest);
        }

        function getPlanTags(plan) {
            return Array.isArray(plan.tags) ? plan.tags : [];
        }

        function getTagClass(tag) {
            if (tag === '模型强') return 'plan-tag--model-strong';
            if (tag === '性价比高') return 'plan-tag--value-rich';
            return '';
        }

        function renderPlanTags(plan) {
            const tags = getPlanTags(plan);
            if (tags.length === 0) return '';
            return `<div class="plan-tags">${tags.map(tag => `<span class="plan-tag ${getTagClass(tag)}">${escapeHtml(tag)}</span>`).join('')}</div>`;
        }

        function updatePresetTagButtons() {
            presetTagButtons.forEach(button => {
                button.classList.toggle('active', selectedTags.has(button.dataset.tagFilter));
            });
        }

        function togglePresetTag(tag) {
            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
            } else {
                selectedTags.add(tag);
            }
            updatePresetTagButtons();
            applyFilters();
        }

        // 初始化筛选器
        function initFilters() {
            // 类型筛选
            const types = [...new Set(allPlans.map(p => p.type || 'Coding Plan'))].sort();
            types.forEach(type => {
                const div = document.createElement('div');
                div.className = 'checkbox-item';
                div.innerHTML = `
                    <input type="checkbox" id="type_${type}" value="${type}" onchange="updateTypeSelection()">
                    <label for="type_${type}">${type}</label>
                `;
                typeCheckboxes.appendChild(div);
            });

            const vendors = uniqueStringsInOrder(allPlans.map(p => p['vendor']));
            vendors.forEach(vendor => {
                const div = document.createElement('div');
                div.className = 'checkbox-item';
                div.innerHTML = `
                    <input type="checkbox" id="vendor_${vendor}" value="${vendor}" onchange="updateVendorSelection()">
                    <label for="vendor_${vendor}">${vendor}</label>
                `;
                vendorCheckboxes.appendChild(div);
            });

            const models = sortModelsForFilterDropdown(
                uniqueStringsInOrder(allPlans.flatMap(p => p.models || []))
            );
            models.forEach(model => {
                const div = document.createElement('div');
                div.className = 'checkbox-item';
                div.innerHTML = `
                    <input type="checkbox" id="model_${model}" value="${model}" onchange="updateModelSelection()">
                    <label for="model_${model}">${model}</label>
                `;
                modelCheckboxes.appendChild(div);
            });
        }

        // 初始化价格滑块
        function initPriceSliders() {
            initPriceSlider('firstMonth');
            initPriceSlider('monthly');
            initPriceSlider('quarterly');
            initPriceSlider('yearly');
        }

        // 非窄屏下：仅当菜单超出视口右缘时，改为相对触发器右对齐（换行后仍按实际位置计算）
        function alignFilterDropdownInViewport(dropdown) {
            dropdown.style.left = '';
            dropdown.style.right = '';
            if (window.matchMedia('(max-width: 768px)').matches) {
                return;
            }
            requestAnimationFrame(() => {
                if (!dropdown.classList.contains('show')) return;
                const margin = 12;
                const rect = dropdown.getBoundingClientRect();
                if (rect.right > window.innerWidth - margin) {
                    dropdown.style.left = 'auto';
                    dropdown.style.right = '0';
                }
            });
        }

        // 下拉菜单控制
        function toggleDropdown(btn, dropdown, type = null) {
            if (activeDropdown && activeDropdown !== dropdown) {
                activeDropdown.classList.remove('show');
                const prevBtn = activeDropdown.previousElementSibling;
                prevBtn.classList.remove('active');
            }

            const isOpen = dropdown.classList.contains('show');
            closeDropdownWithoutFilter();

            if (!isOpen) {
                dropdown.classList.add('show');
                btn.classList.add('active');
                activeDropdown = dropdown;

                // 打开下拉框时，初始化临时状态为当前已确认状态
                if (type === 'type') {
                    tempSelectedTypes = new Set(selectedTypes);
                    syncTypeCheckboxes();
                } else if (type === 'tokenLimit') {
                    if (requestFilters.tokenLimit.min !== null && requestFilters.tokenLimit.max !== null) {
                        updateRequestSliderVisuals('tokenLimit', requestFilters.tokenLimit.min, requestFilters.tokenLimit.max);
                    } else {
                        updateRequestSliderVisuals('tokenLimit', requestSliders.tokenLimit.minValue, requestSliders.tokenLimit.maxValue);
                    }
                } else if (type === 'vendor') {
                    tempSelectedVendors = new Set(selectedVendors);
                    syncVendorCheckboxes();
                } else if (type === 'model') {
                    tempSelectedModels = new Set(selectedModels);
                    syncModelCheckboxes();
                } else if (type && tempPriceFilters[type]) {
                    tempPriceFilters[type].min = priceFilters[type].min;
                    tempPriceFilters[type].max = priceFilters[type].max;
                    if (priceFilters[type].min !== null && priceFilters[type].max !== null) {
                        updateSliderVisuals(type, priceFilters[type].min, priceFilters[type].max);
                    } else {
                        updateSliderVisuals(type, priceSliders[type].minValue, priceSliders[type].maxValue);
                    }
                } else if (type === 'fiveHours' || type === 'weekly' || type === 'monthly') {
                    if (requestFilters[type].min !== null && requestFilters[type].max !== null) {
                        updateRequestSliderVisuals(type, requestFilters[type].min, requestFilters[type].max);
                    } else {
                        updateRequestSliderVisuals(type, requestSliders[type].minValue, requestSliders[type].maxValue);
                    }
                }

                alignFilterDropdownInViewport(dropdown);
            }
        }

        // 同步厂商复选框状态
        function syncTypeCheckboxes() {
            document.querySelectorAll('#typeCheckboxes input').forEach(cb => {
                cb.checked = tempSelectedTypes.has(cb.value);
            });
        }



        function syncVendorCheckboxes() {
            document.querySelectorAll('#vendorCheckboxes input').forEach(cb => {
                cb.checked = tempSelectedVendors.has(cb.value);
            });
        }

        // 同步模型复选框状态
        function syncModelCheckboxes() {
            document.querySelectorAll('#modelCheckboxes input').forEach(cb => {
                cb.checked = tempSelectedModels.has(cb.value);
            });
        }

        function closeAllDropdowns() {
            // 提交临时状态到正式状态
            if (activeDropdown === typeDropdown) {
                selectedTypes = new Set(tempSelectedTypes);
                updateTypeCount();
            } else if (activeDropdown === vendorDropdown) {
                selectedVendors = new Set(tempSelectedVendors);
                updateVendorCount();
            } else if (activeDropdown === modelDropdown) {
                selectedModels = new Set(tempSelectedModels);
                updateModelCount();
            }

            document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            activeDropdown = null;
            // 应用筛选
            applyFilters();
        }

        // 价格筛选的确定按钮单独处理，避免重复调用 applyFilters
        function closeDropdownWithoutFilter() {
            // 恢复按钮显示到已确认状态
            if (activeDropdown === typeDropdown) {
                updateTypeCount();
            } else if (activeDropdown === vendorDropdown) {
                updateVendorCount();
            } else if (activeDropdown === modelDropdown) {
                updateModelCount();
            }

            document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            activeDropdown = null;
        }

        // 筛选 UI 交互必须延后绑定：顶层立即绑定时若任一元素为空会抛错并阻断后续 boot
        function bindPlansTableInteractions() {
            const bindToggle = (btn, dropdown, type) => {
                if (!btn || !dropdown) return;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleDropdown(btn, dropdown, type);
                });
            };

            bindToggle(typeBtn, typeDropdown, 'type');
            bindToggle(tokenLimitBtn, tokenLimitDropdown, 'tokenLimit');
            bindToggle(vendorBtn, vendorDropdown, 'vendor');
            bindToggle(firstMonthPriceBtn, firstMonthPriceDropdown, 'firstMonth');
            bindToggle(monthlyPriceBtn, monthlyPriceDropdown, 'monthly');
            bindToggle(quarterlyPriceBtn, quarterlyPriceDropdown, 'quarterly');
            bindToggle(yearlyPriceBtn, yearlyPriceDropdown, 'yearly');
            bindToggle(fiveHoursRequestBtn, fiveHoursRequestDropdown, 'fiveHours');
            bindToggle(weeklyRequestBtn, weeklyRequestDropdown, 'weekly');
            bindToggle(monthlyRequestBtn, monthlyRequestDropdown, 'monthly');
            bindToggle(modelBtn, modelDropdown, 'model');

            if (presetTagButtons && presetTagButtons.length) {
                presetTagButtons.forEach(button => {
                    button.addEventListener('click', () => {
                        togglePresetTag(button.dataset.tagFilter);
                    });
                });
            }

            document.addEventListener('click', () => {
                closeDropdownWithoutFilter();
            });

            document.querySelectorAll('.dropdown-menu').forEach(d => {
                d.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            });

            document.querySelectorAll('th.sortable').forEach(th => {
                th.addEventListener('click', () => {
                    const column = th.dataset.column;
                    let direction = 'asc';

                    if (currentSort.column === column) {
                        if (currentSort.direction === 'asc') {
                            direction = 'desc';
                        } else if (currentSort.direction === 'desc') {
                            currentSort = { column: null, direction: 'asc' };
                            document.querySelectorAll('th').forEach(header => {
                                header.classList.remove('sort-asc', 'sort-desc');
                            });
                            filteredPlans.sort((a, b) => a.originalIndex - b.originalIndex);
                            renderTable();
                            return;
                        }
                    }

                    sortData(column, direction);
                });
            });

            window.addEventListener('resize', updateStickyColumns);

            if (tableScroll) {
                tableScroll.addEventListener('scroll', () => {
                    requestAnimationFrame(updateStickyColumns);
                });
            }
        }

        // 更新选择
        // 复选框操作只修改临时状态
        function updateTypeSelection() {
            tempSelectedTypes.clear();
            document.querySelectorAll('#typeCheckboxes input:checked').forEach(cb => {
                tempSelectedTypes.add(cb.value);
            });
            updateTempTypeCount();
        }



        function updateVendorSelection() {
            tempSelectedVendors.clear();
            document.querySelectorAll('#vendorCheckboxes input:checked').forEach(cb => {
                tempSelectedVendors.add(cb.value);
            });
            // 显示临时计数
            updateTempVendorCount();
        }

        function updateModelSelection() {
            tempSelectedModels.clear();
            document.querySelectorAll('#modelCheckboxes input:checked').forEach(cb => {
                tempSelectedModels.add(cb.value);
            });
            // 显示临时计数
            updateTempModelCount();
        }

        // 显示临时计数
        function updateTempTypeCount() {
            if (tempSelectedTypes.size > 0) {
                typeCount.textContent = tempSelectedTypes.size;
                typeCount.style.display = 'inline-block';
            } else {
                typeCount.style.display = 'none';
            }
        }



        function updateTempVendorCount() {
            if (tempSelectedVendors.size > 0) {
                vendorCount.textContent = tempSelectedVendors.size;
                vendorCount.style.display = 'inline-block';
            } else {
                vendorCount.style.display = 'none';
            }
        }

        function updateTempModelCount() {
            if (tempSelectedModels.size > 0) {
                modelCount.textContent = tempSelectedModels.size;
                modelCount.style.display = 'inline-block';
            } else {
                modelCount.style.display = 'none';
            }
        }

        // 更新已确认状态的按钮显示
        function updateTypeCount() {
            if (selectedTypes.size > 0) {
                typeCount.textContent = selectedTypes.size;
                typeCount.style.display = 'inline-block';
                typeBtn.classList.add('active');
            } else {
                typeCount.style.display = 'none';
                typeBtn.classList.remove('active');
            }
        }

        function updateTokenLimitCount() {
            if (requestFilters.tokenLimit.min !== null || requestFilters.tokenLimit.max !== null) {
                tokenLimitCount.style.display = 'inline-block';
                tokenLimitBtn.classList.add('active');
            } else {
                tokenLimitCount.style.display = 'none';
                tokenLimitBtn.classList.remove('active');
            }
        }

        function updateVendorCount() {
            if (selectedVendors.size > 0) {
                vendorCount.textContent = selectedVendors.size;
                vendorCount.style.display = 'inline-block';
                vendorBtn.classList.add('active');
            } else {
                vendorCount.style.display = 'none';
                vendorBtn.classList.remove('active');
            }
        }

        function updateModelCount() {
            if (selectedModels.size > 0) {
                modelCount.textContent = selectedModels.size;
                modelCount.style.display = 'inline-block';
                modelBtn.classList.add('active');
            } else {
                modelCount.style.display = 'none';
                modelBtn.classList.remove('active');
            }
        }

        // 价格筛选相关函数
        function updateFirstMonthPriceCount() {
            if (priceFilters.firstMonth.min !== null || priceFilters.firstMonth.max !== null) {
                firstMonthPriceCount.style.display = 'inline-block';
                firstMonthPriceBtn.classList.add('active');
            } else {
                firstMonthPriceCount.style.display = 'none';
                firstMonthPriceBtn.classList.remove('active');
            }
        }

        function updateMonthlyPriceCount() {
            if (priceFilters.monthly.min !== null || priceFilters.monthly.max !== null) {
                monthlyPriceCount.style.display = 'inline-block';
                monthlyPriceBtn.classList.add('active');
            } else {
                monthlyPriceCount.style.display = 'none';
                monthlyPriceBtn.classList.remove('active');
            }
        }

        function updateQuarterlyPriceCount() {
            if (priceFilters.quarterly.min !== null || priceFilters.quarterly.max !== null) {
                quarterlyPriceCount.style.display = 'inline-block';
                quarterlyPriceBtn.classList.add('active');
            } else {
                quarterlyPriceCount.style.display = 'none';
                quarterlyPriceBtn.classList.remove('active');
            }
        }

        function updateYearlyPriceCount() {
            if (priceFilters.yearly.min !== null || priceFilters.yearly.max !== null) {
                yearlyPriceCount.style.display = 'inline-block';
                yearlyPriceBtn.classList.add('active');
            } else {
                yearlyPriceCount.style.display = 'none';
                yearlyPriceBtn.classList.remove('active');
            }
        }

        function updateFiveHoursRequestCount() {
            if (requestFilters.fiveHours.min !== null || requestFilters.fiveHours.max !== null) {
                fiveHoursRequestCount.style.display = 'inline-block';
                fiveHoursRequestBtn.classList.add('active');
            } else {
                fiveHoursRequestCount.style.display = 'none';
                fiveHoursRequestBtn.classList.remove('active');
            }
        }

        function updateWeeklyRequestCount() {
            if (requestFilters.weekly.min !== null || requestFilters.weekly.max !== null) {
                weeklyRequestCount.style.display = 'inline-block';
                weeklyRequestBtn.classList.add('active');
            } else {
                weeklyRequestCount.style.display = 'none';
                weeklyRequestBtn.classList.remove('active');
            }
        }

        function updateMonthlyRequestCount() {
            if (requestFilters.monthly.min !== null || requestFilters.monthly.max !== null) {
                monthlyRequestCount.style.display = 'inline-block';
                monthlyRequestBtn.classList.add('active');
            } else {
                monthlyRequestCount.style.display = 'none';
                monthlyRequestBtn.classList.remove('active');
            }
        }

        // 应用筛选
        function applyFilters() {
            filteredPlans = allPlans.filter(plan => {
                // 已下线筛选：默认隐藏已下线套餐
                const showDiscontinued = document.getElementById('showDiscontinued').checked;
                if (plan.discontinued && !showDiscontinued) {
                    return false;
                }

                // 类型筛选
                if (selectedTypes.size > 0 && !selectedTypes.has(plan.type || 'Coding Plan')) {
                    return false;
                }

                // 厂商筛选
                if (selectedVendors.size > 0 && !selectedVendors.has(plan['vendor'])) {
                    return false;
                }

                // 模型筛选（多选时取交集：套餐必须同时包含所有选中的模型）
                if (selectedModels.size > 0) {
                    const hasAllModels = [...selectedModels].every(model => plan.models.includes(model));
                    if (!hasAllModels) return false;
                }

                if (selectedTags.size > 0) {
                    const planTags = getPlanTags(plan);
                    const hasAllTags = [...selectedTags].every(tag => planTags.includes(tag));
                    if (!hasAllTags) return false;
                }

                // 首月价格筛选
                if (isPriceFilterApplied('firstMonth')) {
                    if (priceFilters.firstMonth.min > 0 && plan.firstMonthPrice < priceFilters.firstMonth.min) {
                        return false;
                    }
                    if (priceFilters.firstMonth.max < priceSliders.firstMonth.maxValue && plan.firstMonthPrice > priceFilters.firstMonth.max) {
                        return false;
                    }
                }

                // 包月价格筛选
                if (isPriceFilterApplied('monthly')) {
                    if (priceFilters.monthly.min > 0 && plan.monthlyPrice < priceFilters.monthly.min) {
                        return false;
                    }
                    if (priceFilters.monthly.max < priceSliders.monthly.maxValue && plan.monthlyPrice > priceFilters.monthly.max) {
                        return false;
                    }
                }

                // 包季价格筛选
                if (isPriceFilterApplied('quarterly')) {
                    if (priceFilters.quarterly.min > 0 && plan.quarterlyPrice < priceFilters.quarterly.min) {
                        return false;
                    }
                    if (priceFilters.quarterly.max < priceSliders.quarterly.maxValue && plan.quarterlyPrice > priceFilters.quarterly.max) {
                        return false;
                    }
                }

                // 包年价格筛选
                if (isPriceFilterApplied('yearly')) {
                    if (priceFilters.yearly.min > 0 && plan.yearlyPrice < priceFilters.yearly.min) {
                        return false;
                    }
                    if (priceFilters.yearly.max < priceSliders.yearly.maxValue && plan.yearlyPrice > priceFilters.yearly.max) {
                        return false;
                    }
                }

                // 5小时请求数筛选
                if (isRequestFilterApplied('fiveHours')) {
                    if (typeof plan.fiveHoursRequests !== 'number') return false;
                    if (plan.fiveHoursRequests < requestFilters.fiveHours.min) return false;
                    if (plan.fiveHoursRequests > requestFilters.fiveHours.max) return false;
                }

                // 每周请求数筛选
                if (isRequestFilterApplied('weekly')) {
                    if (typeof plan.weeklyRequests !== 'number') return false;
                    if (plan.weeklyRequests < requestFilters.weekly.min) return false;
                    if (plan.weeklyRequests > requestFilters.weekly.max) return false;
                }

                // 每月请求数筛选
                if (isRequestFilterApplied('monthly')) {
                    if (typeof plan.monthlyRequests !== 'number') return false;
                    if (plan.monthlyRequests < requestFilters.monthly.min) return false;
                    if (plan.monthlyRequests > requestFilters.monthly.max) return false;
                }

                // Token上限筛选
                if (isRequestFilterApplied('tokenLimit')) {
                    if (typeof plan.tokenLimit !== 'number') return false;
                    if (plan.tokenLimit < requestFilters.tokenLimit.min) return false;
                    if (plan.tokenLimit > requestFilters.tokenLimit.max) return false;
                }

                return true;
            });

            showingCount.textContent = filteredPlans.length;
            totalCount.textContent = allPlans.length;

            if (currentSort.column) {
                sortData(currentSort.column, currentSort.direction);
            } else {
                renderTable();
            }
        }

        // 价格滑块状态
        const priceSliders = {
            firstMonth: { min: 0, max: 0, minValue: 1, maxValue: 0 },
            monthly: { min: 0, max: 0, minValue: 1, maxValue: 0 },
            quarterly: { min: 0, max: 0, minValue: 1, maxValue: 0 },
            yearly: { min: 0, max: 0, minValue: 1, maxValue: 0 }
        };

        const requestSliders = {
            fiveHours: { min: 0, max: 0, minValue: 0, maxValue: 0 },
            weekly: { min: 0, max: 0, minValue: 0, maxValue: 0 },
            monthly: { min: 0, max: 0, minValue: 0, maxValue: 0 },
            tokenLimit: { min: 0, max: 0, minValue: 0, maxValue: 0 }
        };

        const requestPlanField = {
            fiveHours: 'fiveHoursRequests',
            weekly: 'weeklyRequests',
            monthly: 'monthlyRequests',
            tokenLimit: 'tokenLimit'
        };

        const requestSliderIdPrefix = {
            fiveHours: 'fiveHoursRequest',
            weekly: 'weeklyRequest',
            monthly: 'monthlyRequest',
            tokenLimit: 'tokenLimit'
        };

        // 计算价格类型的最大值
        function getMaxPrice(priceType) {
            if (allPlans.length === 0) return 1000;
            const priceKey = priceType + 'Price';
            const maxPrice = Math.max(...allPlans.map(plan => plan[priceKey]));
            return Math.ceil(maxPrice); // 向上取整
        }

        // 计算价格类型的最小值
        function getMinPrice(priceType) {
            if (allPlans.length === 0) return 1;
            const priceKey = priceType + 'Price';
            const prices = allPlans.map(plan => plan[priceKey]).filter(p => p > 0);
            if (prices.length === 0) return 1;
            return Math.floor(Math.min(...prices)); // 向下取整
        }

        // 初始化价格滑块
        function initPriceSlider(priceType) {
            const slider = {
                minThumb: document.getElementById(`${priceType}SliderMin`),
                maxThumb: document.getElementById(`${priceType}SliderMax`),
                range: document.getElementById(`${priceType}SliderRange`),
                minValue: document.getElementById(`${priceType}MinValue`),
                maxValue: document.getElementById(`${priceType}MaxValue`)
            };

            const minPrice = getMinPrice(priceType);
            const maxPrice = getMaxPrice(priceType);
            priceSliders[priceType].minValue = minPrice;
            priceSliders[priceType].maxValue = maxPrice;
            priceSliders[priceType].min = minPrice;
            priceSliders[priceType].max = maxPrice;

            updateSliderVisuals(priceType, minPrice, maxPrice);

            // 添加拖动事件
            addSliderDragEvents(priceType, slider);
        }

        // 更新滑块视觉效果（对数刻度）
        function updateSliderVisuals(priceType, minPrice, maxPrice) {
            const slider = priceSliders[priceType];
            const minValue = Math.max(slider.minValue, Math.round(minPrice));
            const maxValue = Math.min(slider.maxValue, Math.round(maxPrice));
            const minLog = Math.log10(slider.minValue);
            const maxLog = Math.log10(slider.maxValue);

            // 对数刻度计算位置
            const minPercent = ((Math.log10(minValue) - minLog) / (maxLog - minLog)) * 100;
            const maxPercent = ((Math.log10(maxValue) - minLog) / (maxLog - minLog)) * 100;

            const minThumb = document.getElementById(`${priceType}SliderMin`);
            const maxThumb = document.getElementById(`${priceType}SliderMax`);
            const range = document.getElementById(`${priceType}SliderRange`);
            const minValueEl = document.getElementById(`${priceType}MinValue`);
            const maxValueEl = document.getElementById(`${priceType}MaxValue`);

            if (minThumb) minThumb.style.left = `${minPercent}%`;
            if (maxThumb) maxThumb.style.left = `${maxPercent}%`;
            if (range) {
                range.style.left = `${minPercent}%`;
                range.style.width = `${maxPercent - minPercent}%`;
            }
            if (minValueEl) minValueEl.textContent = `¥${minValue}`;
            if (maxValueEl) maxValueEl.textContent = `¥${maxValue}`;

            slider.min = minValue;
            slider.max = maxValue;
        }

        // 添加滑块拖动事件
        function addSliderDragEvents(priceType, slider) {
            const { minThumb, maxThumb } = slider;
            let isDragging = null;

            const handleDrag = (e) => {
                if (isDragging === null) return;

                const rect = slider.minThumb.parentElement.getBoundingClientRect();
                const x = (e.clientX || e.touches[0].clientX) - rect.left;
                let percent = (x / rect.width) * 100;
                percent = Math.max(0, Math.min(100, percent));

                // 从对数刻度转换回实际值
                const minLog = Math.log10(priceSliders[priceType].minValue);
                const maxLog = Math.log10(priceSliders[priceType].maxValue);
                const value = Math.pow(10, minLog + (percent / 100) * (maxLog - minLog));

                if (isDragging === 'min') {
                    const newMin = Math.min(value, priceSliders[priceType].max);
                    updateSliderVisuals(priceType, newMin, priceSliders[priceType].max);
                } else if (isDragging === 'max') {
                    const newMax = Math.max(value, priceSliders[priceType].min);
                    updateSliderVisuals(priceType, priceSliders[priceType].min, newMax);
                }
            };

            const startDrag = (type) => (e) => {
                e.preventDefault();
                isDragging = type;
                document.addEventListener('mousemove', handleDrag);
                document.addEventListener('mouseup', stopDrag);
                document.addEventListener('touchmove', handleDrag);
                document.addEventListener('touchend', stopDrag);
            };

            const stopDrag = () => {
                isDragging = null;
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', stopDrag);
                document.removeEventListener('touchmove', handleDrag);
                document.removeEventListener('touchend', stopDrag);
            };

            minThumb.addEventListener('mousedown', startDrag('min'));
            minThumb.addEventListener('touchstart', startDrag('min'));
            maxThumb.addEventListener('mousedown', startDrag('max'));
            maxThumb.addEventListener('touchstart', startDrag('max'));
        }

        function getNumericRequestValues(requestType) {
            const key = requestPlanField[requestType];
            return allPlans.map(plan => plan[key]).filter(v => typeof v === 'number');
        }

        function getMinRequest(requestType) {
            const nums = getNumericRequestValues(requestType);
            if (nums.length === 0) return 0;
            return Math.floor(Math.min(...nums));
        }

        function getMaxRequest(requestType) {
            const nums = getNumericRequestValues(requestType);
            if (nums.length === 0) return 1;
            return Math.ceil(Math.max(...nums));
        }

        function initRequestSliders() {
            initRequestSlider('fiveHours');
            initRequestSlider('weekly');
            initRequestSlider('monthly');
            initRequestSlider('tokenLimit');
        }

        function initRequestSlider(requestType) {
            const prefix = requestSliderIdPrefix[requestType];
            const slider = {
                minThumb: document.getElementById(`${prefix}SliderMin`),
                maxThumb: document.getElementById(`${prefix}SliderMax`)
            };
            let minBound = getMinRequest(requestType);
            let maxBound = getMaxRequest(requestType);
            if (maxBound <= minBound) {
                maxBound = minBound + 1;
            }
            requestSliders[requestType].minValue = minBound;
            requestSliders[requestType].maxValue = maxBound;
            requestSliders[requestType].min = minBound;
            requestSliders[requestType].max = maxBound;
            updateRequestSliderVisuals(requestType, minBound, maxBound);
            addRequestSliderDragEvents(requestType, slider);
        }

        function updateRequestSliderVisuals(requestType, minVal, maxVal) {
            const slider = requestSliders[requestType];
            const prefix = requestSliderIdPrefix[requestType];
            let a = Math.max(slider.minValue, Math.round(minVal));
            let b = Math.min(slider.maxValue, Math.round(maxVal));
            const minValue = Math.min(a, b);
            const maxValue = Math.max(a, b);
            const span = slider.maxValue - slider.minValue || 1;
            const minPercent = ((minValue - slider.minValue) / span) * 100;
            const maxPercent = ((maxValue - slider.minValue) / span) * 100;

            const minThumb = document.getElementById(`${prefix}SliderMin`);
            const maxThumb = document.getElementById(`${prefix}SliderMax`);
            const range = document.getElementById(`${prefix}SliderRange`);
            const minValueEl = document.getElementById(`${prefix}MinValue`);
            const maxValueEl = document.getElementById(`${prefix}MaxValue`);

            if (minThumb) minThumb.style.left = `${minPercent}%`;
            if (maxThumb) maxThumb.style.left = `${maxPercent}%`;
            if (range) {
                range.style.left = `${minPercent}%`;
                range.style.width = `${maxPercent - minPercent}%`;
            }
            const fmt = (n) => {
                if (typeof n !== 'number') return String(n);
                return requestType === 'tokenLimit' ? n.toLocaleString() + 'M' : n.toLocaleString();
            };
            if (minValueEl) minValueEl.textContent = fmt(minValue);
            if (maxValueEl) maxValueEl.textContent = fmt(maxValue);

            slider.min = minValue;
            slider.max = maxValue;
        }

        function addRequestSliderDragEvents(requestType, slider) {
            const { minThumb, maxThumb } = slider;
            let isDragging = null;

            const handleDrag = (e) => {
                if (isDragging === null) return;

                const rect = minThumb.parentElement.getBoundingClientRect();
                const x = (e.clientX || e.touches[0].clientX) - rect.left;
                let percent = (x / rect.width) * 100;
                percent = Math.max(0, Math.min(100, percent));

                const rs = requestSliders[requestType];
                const span = rs.maxValue - rs.minValue || 1;
                const value = rs.minValue + (percent / 100) * span;
                const rounded = Math.round(value);

                if (isDragging === 'min') {
                    const newMin = Math.min(rounded, rs.max);
                    updateRequestSliderVisuals(requestType, newMin, rs.max);
                } else if (isDragging === 'max') {
                    const newMax = Math.max(rounded, rs.min);
                    updateRequestSliderVisuals(requestType, rs.min, newMax);
                }
            };

            const startDrag = (type) => (e) => {
                e.preventDefault();
                isDragging = type;
                document.addEventListener('mousemove', handleDrag);
                document.addEventListener('mouseup', stopDrag);
                document.addEventListener('touchmove', handleDrag);
                document.addEventListener('touchend', stopDrag);
            };

            const stopDrag = () => {
                isDragging = null;
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', stopDrag);
                document.removeEventListener('touchmove', handleDrag);
                document.removeEventListener('touchend', stopDrag);
            };

            minThumb.addEventListener('mousedown', startDrag('min'));
            minThumb.addEventListener('touchstart', startDrag('min'));
            maxThumb.addEventListener('mousedown', startDrag('max'));
            maxThumb.addEventListener('touchstart', startDrag('max'));
        }

        // 首月价格筛选
        function applyFirstMonthPriceFilter() {
            // 提交临时状态到正式状态
            const isInitial = priceSliders.firstMonth.min === priceSliders.firstMonth.minValue &&
                              priceSliders.firstMonth.max === priceSliders.firstMonth.maxValue;
            if (isInitial) {
                priceFilters.firstMonth.min = null;
                priceFilters.firstMonth.max = null;
            } else {
                priceFilters.firstMonth.min = priceSliders.firstMonth.min;
                priceFilters.firstMonth.max = priceSliders.firstMonth.max;
            }
            updateFirstMonthPriceCount();
            applyFilters();
            closeDropdownWithoutFilter();
        }

        function resetFirstMonthPriceFilter() {
            // 重置只影响临时状态（滑块显示），不提交
            updateSliderVisuals('firstMonth', priceSliders.firstMonth.minValue, priceSliders.firstMonth.maxValue);
        }

        // 包月价格筛选
        function applyMonthlyPriceFilter() {
            const isInitial = priceSliders.monthly.min === priceSliders.monthly.minValue &&
                              priceSliders.monthly.max === priceSliders.monthly.maxValue;
            if (isInitial) {
                priceFilters.monthly.min = null;
                priceFilters.monthly.max = null;
            } else {
                priceFilters.monthly.min = priceSliders.monthly.min;
                priceFilters.monthly.max = priceSliders.monthly.max;
            }
            updateMonthlyPriceCount();
            applyFilters();
            closeDropdownWithoutFilter();
        }

        function resetMonthlyPriceFilter() {
            // 重置只影响临时状态（滑块显示），不提交
            updateSliderVisuals('monthly', priceSliders.monthly.minValue, priceSliders.monthly.maxValue);
        }

        // 包季价格筛选
        function applyQuarterlyPriceFilter() {
            const isInitial = priceSliders.quarterly.min === priceSliders.quarterly.minValue &&
                              priceSliders.quarterly.max === priceSliders.quarterly.maxValue;
            if (isInitial) {
                priceFilters.quarterly.min = null;
                priceFilters.quarterly.max = null;
            } else {
                priceFilters.quarterly.min = priceSliders.quarterly.min;
                priceFilters.quarterly.max = priceSliders.quarterly.max;
            }
            updateQuarterlyPriceCount();
            applyFilters();
            closeDropdownWithoutFilter();
        }

        function resetQuarterlyPriceFilter() {
            // 重置只影响临时状态（滑块显示），不提交
            updateSliderVisuals('quarterly', priceSliders.quarterly.minValue, priceSliders.quarterly.maxValue);
        }

        // 包年价格筛选
        function applyYearlyPriceFilter() {
            const isInitial = priceSliders.yearly.min === priceSliders.yearly.minValue &&
                              priceSliders.yearly.max === priceSliders.yearly.maxValue;
            if (isInitial) {
                priceFilters.yearly.min = null;
                priceFilters.yearly.max = null;
            } else {
                priceFilters.yearly.min = priceSliders.yearly.min;
                priceFilters.yearly.max = priceSliders.yearly.max;
            }
            updateYearlyPriceCount();
            applyFilters();
            closeDropdownWithoutFilter();
        }

        function resetYearlyPriceFilter() {
            // 重置只影响临时状态（滑块显示），不提交
            updateSliderVisuals('yearly', priceSliders.yearly.minValue, priceSliders.yearly.maxValue);
        }

        function applyFiveHoursRequestFilter() {
            const isInitial = requestSliders.fiveHours.min === requestSliders.fiveHours.minValue &&
                              requestSliders.fiveHours.max === requestSliders.fiveHours.maxValue;
            if (isInitial) {
                requestFilters.fiveHours.min = null;
                requestFilters.fiveHours.max = null;
            } else {
                requestFilters.fiveHours.min = requestSliders.fiveHours.min;
                requestFilters.fiveHours.max = requestSliders.fiveHours.max;
            }
            updateFiveHoursRequestCount();
            applyFilters();
            closeDropdownWithoutFilter();
        }

        function resetFiveHoursRequestFilter() {
            updateRequestSliderVisuals('fiveHours', requestSliders.fiveHours.minValue, requestSliders.fiveHours.maxValue);
        }

        function applyWeeklyRequestFilter() {
            const isInitial = requestSliders.weekly.min === requestSliders.weekly.minValue &&
                              requestSliders.weekly.max === requestSliders.weekly.maxValue;
            if (isInitial) {
                requestFilters.weekly.min = null;
                requestFilters.weekly.max = null;
            } else {
                requestFilters.weekly.min = requestSliders.weekly.min;
                requestFilters.weekly.max = requestSliders.weekly.max;
            }
            updateWeeklyRequestCount();
            applyFilters();
            closeDropdownWithoutFilter();
        }

        function resetWeeklyRequestFilter() {
            updateRequestSliderVisuals('weekly', requestSliders.weekly.minValue, requestSliders.weekly.maxValue);
        }

        function applyMonthlyRequestFilter() {
            const isInitial = requestSliders.monthly.min === requestSliders.monthly.minValue &&
                              requestSliders.monthly.max === requestSliders.monthly.maxValue;
            if (isInitial) {
                requestFilters.monthly.min = null;
                requestFilters.monthly.max = null;
            } else {
                requestFilters.monthly.min = requestSliders.monthly.min;
                requestFilters.monthly.max = requestSliders.monthly.max;
            }
            updateMonthlyRequestCount();
            applyFilters();
            closeDropdownWithoutFilter();
        }

        function resetMonthlyRequestFilter() {
            updateRequestSliderVisuals('monthly', requestSliders.monthly.minValue, requestSliders.monthly.maxValue);
        }

        function applyTokenLimitFilter() {
            const isInitial = requestSliders.tokenLimit.min === requestSliders.tokenLimit.minValue &&
                              requestSliders.tokenLimit.max === requestSliders.tokenLimit.maxValue;
            if (isInitial) {
                requestFilters.tokenLimit.min = null;
                requestFilters.tokenLimit.max = null;
            } else {
                requestFilters.tokenLimit.min = requestSliders.tokenLimit.min;
                requestFilters.tokenLimit.max = requestSliders.tokenLimit.max;
            }
            updateTokenLimitCount();
            applyFilters();
            closeDropdownWithoutFilter();
        }

        // 重置筛选
        function resetVendorFilter() {
            // 重置只影响临时状态，不提交
            tempSelectedVendors.clear();
            document.querySelectorAll('#vendorCheckboxes input').forEach(cb => cb.checked = false);
            updateTempVendorCount();
        }

        function resetModelFilter() {
            // 重置只影响临时状态，不提交
            tempSelectedModels.clear();
            document.querySelectorAll('#modelCheckboxes input').forEach(cb => cb.checked = false);
            updateTempModelCount();
        }

        function resetTypeFilter() {
            tempSelectedTypes.clear();
            document.querySelectorAll('#typeCheckboxes input').forEach(cb => cb.checked = false);
            updateTempTypeCount();
        }

        function resetTokenLimitFilter() {
            updateRequestSliderVisuals('tokenLimit', requestSliders.tokenLimit.minValue, requestSliders.tokenLimit.maxValue);
        }

        function resetAllFilters() {
            // 重置显示已下线套餐复选框
            document.getElementById('showDiscontinued').checked = false;

            // 重置价格筛选状态
            priceFilters.firstMonth.min = null;
            priceFilters.firstMonth.max = null;
            priceFilters.monthly.min = null;
            priceFilters.monthly.max = null;
            priceFilters.quarterly.min = null;
            priceFilters.quarterly.max = null;
            priceFilters.yearly.min = null;
            priceFilters.yearly.max = null;

            // 重置请求数筛选状态
            requestFilters.fiveHours.min = null;
            requestFilters.fiveHours.max = null;
            requestFilters.weekly.min = null;
            requestFilters.weekly.max = null;
            requestFilters.monthly.min = null;
            requestFilters.monthly.max = null;
            requestFilters.tokenLimit.min = null;
            requestFilters.tokenLimit.max = null;

            // 重置所有滑块到初始范围
            Object.keys(priceSliders).forEach(type => {
                updateSliderVisuals(type, priceSliders[type].minValue, priceSliders[type].maxValue);
            });
            Object.keys(requestSliders).forEach(type => {
                updateRequestSliderVisuals(type, requestSliders[type].minValue, requestSliders[type].maxValue);
            });

            resetTypeFilter();
            resetVendorFilter();
            resetModelFilter();
            resetTokenLimitFilter();

            selectedTypes.clear();
            selectedTags.clear();
            updateTypeCount();
            selectedVendors.clear();
            updateVendorCount();
            selectedModels.clear();
            updateModelCount();
            updatePresetTagButtons();
            updateFirstMonthPriceCount();
            updateMonthlyPriceCount();
            updateQuarterlyPriceCount();
            updateYearlyPriceCount();
            updateFiveHoursRequestCount();
            updateWeeklyRequestCount();
            updateMonthlyRequestCount();
            updateTokenLimitCount();
            applyFilters();
        }

        // 排序数据
        function sortData(column, direction = 'asc') {
            currentSort = { column, direction };

            // 辅助函数：将请求次数值转换为可排序的数值
            const getRequestSortValue = (value) => {
                if (typeof value === 'number') return value;
                if (value === '无限制') return Infinity;  // 无限制排在最大
                if (value === '未公开') return -1;        // 未公开排在最小
                return -1;
            };

            // 辅助函数：将价格统一换算为人民币（$1 = ¥7）
            const getPriceSortValue = (plan, field) => {
                const v = plan[field];
                if (typeof v !== 'number') return -1;  // '-' 等非数字排最小
                return plan.currency === '$' ? v * 7 : v;
            };

            filteredPlans.sort((a, b) => {
                let valueA, valueB;

                switch (column) {
                    case 'vendor':
                        valueA = a['vendor'];
                        valueB = b['vendor'];
                        break;
                    case 'plan':
                        valueA = a['plan'];
                        valueB = b['plan'];
                        break;
                    case 'action':
                        valueA = a['plan'];
                        valueB = b['plan'];
                        break;
                    case 'firstMonthPrice':
                        valueA = getPriceSortValue(a, 'firstMonthPrice');
                        valueB = getPriceSortValue(b, 'firstMonthPrice');
                        break;
                    case 'monthlyPrice':
                        valueA = getPriceSortValue(a, 'monthlyPrice');
                        valueB = getPriceSortValue(b, 'monthlyPrice');
                        break;
                    case 'quarterlyPrice':
                        valueA = getPriceSortValue(a, 'quarterlyPrice');
                        valueB = getPriceSortValue(b, 'quarterlyPrice');
                        break;
                    case 'yearlyPrice':
                        valueA = getPriceSortValue(a, 'yearlyPrice');
                        valueB = getPriceSortValue(b, 'yearlyPrice');
                        break;
                    case 'models':
                        valueA = a['支持模型'];
                        valueB = b['支持模型'];
                        break;
                    case 'fiveHoursRequests':
                        valueA = getRequestSortValue(a.fiveHoursRequests);
                        valueB = getRequestSortValue(b.fiveHoursRequests);
                        break;
                    case 'weeklyRequests':
                        valueA = getRequestSortValue(a.weeklyRequests);
                        valueB = getRequestSortValue(b.weeklyRequests);
                        break;
                    case 'monthlyRequests':
                        valueA = getRequestSortValue(a.monthlyRequests);
                        valueB = getRequestSortValue(b.monthlyRequests);
                        break;
                    case 'measuredFiveHoursTokenLimit':
                        valueA = getRequestSortValue(a.measuredFiveHoursTokenLimit);
                        valueB = getRequestSortValue(b.measuredFiveHoursTokenLimit);
                        break;
                    case 'measuredWeeklyTokenLimit':
                        valueA = getRequestSortValue(a.measuredWeeklyTokenLimit);
                        valueB = getRequestSortValue(b.measuredWeeklyTokenLimit);
                        break;
                    case 'measuredMonthlyTokenLimit':
                        valueA = getRequestSortValue(a.measuredMonthlyTokenLimit);
                        valueB = getRequestSortValue(b.measuredMonthlyTokenLimit);
                        break;
                    case 'tokenLimit':
                        valueA = getRequestSortValue(a.tokenLimit);
                        valueB = getRequestSortValue(b.tokenLimit);
                        break;
                    case 'benefits':
                        valueA = a['其他权益'];
                        valueB = b['其他权益'];
                        break;
                    case 'note':
                        valueA = a['note'];
                        valueB = b['note'];
                        break;
                    case 'rating':
                        valueA = a.rating || 0;
                        valueB = b.rating || 0;
                        break;
                    default:
                        return 0;
                }

                if (typeof valueA === 'number') {
                    return direction === 'asc' ? valueA - valueB : valueB - valueA;
                } else {
                    return direction === 'asc'
                        ? valueA.localeCompare(valueB, 'zh-CN')
                        : valueB.localeCompare(valueA, 'zh-CN');
                }
            });

            renderTable();
            updateSortHeaders();
        }

        function updateSortHeaders() {
            document.querySelectorAll('th').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
                if (th.dataset.column === currentSort.column) {
                    th.classList.add(`sort-${currentSort.direction}`);
                }
            });
        }

        // 动态设置冻结列的 left 值
        function updateStickyColumns() {
            const firstCells = document.querySelectorAll('td.sticky-first, th.sticky-first');
            const secondCells = document.querySelectorAll('td.sticky-second, th.sticky-second');

            let firstWidth = 0;
            firstCells.forEach(cell => {
                firstWidth = Math.max(firstWidth, cell.offsetWidth);
                cell.style.left = '0px';
            });

            secondCells.forEach(cell => {
                cell.style.left = firstWidth + 'px';
            });
        }

        // 渲染表格
        function renderTable() {
            if (filteredPlans.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="18">
                            <div class="empty-state">
                                <div class="empty-state-icon">📭</div>
                                <div class="empty-state-text">没有找到符合条件的套餐</div>
                                <div class="empty-state-hint">请调整筛选条件或重置筛选</div>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = filteredPlans.map(plan => `
                <tr class="plan-row${plan.discontinued ? ' discontinued' : ''}">
                    <td class="sticky-first"><span class="vendor-name">${escapeHtml(plan['vendor'])}</span></td>
                    <td class="sticky-second"><span class="plan-name">${escapeHtml(plan['plan'])}</span></td>
                    <td><span class="type-tag ${(plan.type || 'Coding Plan') === 'Token Plan' ? 'token-plan' : 'coding-plan'}">${escapeHtml(plan.type || 'Coding Plan')}</span></td>
                    <td>
                        <a href="${escapeHtml(plan['action'])}" target="_blank" class="action-btn">
                            跳转开通
                        </a>
                    </td>
                    <td class="rating-stars">${'★'.repeat(plan.rating || 0)}${'☆'.repeat(5 - (plan.rating || 0))}</td>
                    <td class="plan-tags-cell">${renderPlanTags(plan)}</td>
                    <td><span class="price">${plan.currency||'¥'}${formatPrice(plan.firstMonthPrice)} <span class="unit">/ 首月</span></span></td>
                    <td><span class="price-monthly">${plan.currency||'¥'}${formatPrice(plan.monthlyPrice)} <span class="unit">/ 月</span></span></td>
                    <td><span class="price-normal">${plan.currency||'¥'}${formatPrice(plan.quarterlyPrice)} <span class="price-original">${plan.currency||'¥'}${formatPrice(plan.monthlyPrice * 3)}</span> <span class="unit">/ 季</span></span></td>
                    <td><span class="price-normal">${plan.currency||'¥'}${formatPrice(plan.yearlyPrice)} <span class="price-original">${plan.currency||'¥'}${formatPrice(plan.monthlyPrice * 12)}</span> <span class="unit">/ 年</span></span></td>
                    <td><span class="request-count">${formatRequestCount(plan.fiveHoursRequests)} <span class="unit">/ 5小时</span></span></td>
                    <td><span class="request-count">${formatRequestCount(plan.weeklyRequests)} <span class="unit">/ 周</span></span></td>
                    <td><span class="request-count">${formatRequestCount(plan.monthlyRequests)} <span class="unit">/ 月</span></span></td>
                    <td><span class="request-count">${formatMeasuredToken(plan.measuredFiveHoursTokenLimit)}</span></td>
                    <td><span class="request-count">${formatMeasuredToken(plan.measuredWeeklyTokenLimit)}</span></td>
                    <td><span class="request-count">${formatMeasuredToken(plan.measuredMonthlyTokenLimit)}</span></td>
                    <td><span class="request-count">${typeof plan.tokenLimit === 'number' ? plan.tokenLimit + 'M <span class="unit">Tokens</span>' : escapeHtml(plan.tokenLimit || '无限制')}</span></td>
                    <td>
                        ${plan.models.map(model => `<span class="model-tag">${escapeHtml(model)}</span>`).join('')}
                    </td>
                    <td>
                        ${plan.benefits.map(benefit => `<span class="benefit">${escapeHtml(benefit)}</span>`).join('')}
                    </td>
                    <td>${plan.discontinued ? '<span class="status-offline">已下线</span>' : ''}</td>
                    <td><span class="note">${(plan['note'] || '').replace(/\n/g, '<br>')}</span></td>
                </tr>
            `).join('');

            setTimeout(updateStickyColumns, 0);
        }

        // 价格格式化函数：整数不显示小数，小数显示两位
        function formatPrice(price) {
            if (Number.isInteger(price)) {
                return price.toString();
            } else {
                return price.toFixed(2);
            }
        }

        // 请求次数格式化函数：数字则格式化，字符串直接返回
        function formatRequestCount(value) {
            if (typeof value === 'number') {
                return value.toLocaleString();
            }
            return value;
        }

        function formatMeasuredToken(value) {
            if (typeof value !== 'number') return '-';
            return value + 'M';
        }


        // 加载配置文件
        async function loadConfig() {
            try {
                const response = await fetch(CONFIG_FILE_PATH, {
                    cache: 'no-store'
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                appConfig = await response.json();
                window.appConfig = appConfig;
                try {
                    applyConfig();
                } catch (applyError) {
                    console.error('应用配置失败（保留已加载 config，含 platformCatalog）:', applyError);
                }
                console.log('成功加载配置文件');
            } catch (error) {
                console.error('加载配置失败:', error);
                // 使用默认配置（与 codingplan/config.json 及本页静态文案对齐）
                appConfig = {
                    header: {
                        title: "AI Coding 平台推荐",
                        updateDate: "更新日期2026.7.15 | 首页改版：平台目录与标签筛选",
                        subtitle: "29 家 Coding Plan / Token Plan 平台一站式选型\n智谱AI、MiniMax、字节·方舟、讯飞·星火、Kimi、OpenCode、阿里·百炼、DeepSeek 等，按性价比、稳定性、模型覆盖、使用便捷性对比",
                        models: "首页以「选平台」为主：默认不展示需抢购平台，也可按「性价比高」「模型覆盖广」等维度快速缩小范围；下方套餐表仍保留全量对比。",
                        watermarkUrl: "www.codingplan.fyi",
                        entry: {
                            url: "https://github.com/wmpeng/codingplan/discussions",
                            text: "Github 反馈"
                        }
                    },
                    platformCatalog: {
                        defaultSelectedTags: [],
                        operationalTags: ["热门模型", "适合养龙虾", "可支付宝"],
                        showDiscontinuedTag: "显示停售",
                        showRushPurchaseTag: "显示需抢购",
                        derivedTags: [
                            { id: "high-value", label: "性价比高", rule: { dimension: "value", minScore: 4 } },
                            { id: "stable", label: "稳定性好", rule: { dimension: "stability", minScore: 4 } },
                            { id: "broad-models", label: "模型覆盖广", rule: { dimension: "models", minScore: 4 } },
                            { id: "convenient", label: "使用便捷", rule: { dimension: "convenience", minScore: 4 } }
                        ]
                    },
                    feedback: {
                        triggerText: "反馈与用户群",
                        dataIssue: {
                            text: "Github 反馈",
                            url: "https://github.com/wmpeng/codingplan/discussions"
                        },
                        feedbackEntry: {
                            text: "点此加入",
                            url: "https://api.dreamfree.space/c/s/cpfeishulink"
                        },
                        group: {
                            title: "飞书讨论群",
                            qrImage: "assets/feishu_group.png",
                            qrAlt: "飞书群二维码"
                        }
                    },
                    community: {
                        eyebrow: "加入社群",
                        title: "进群获取价格变化和选型反馈",
                        description: "扫码加入飞书群，第一时间看价格/限购提醒，也能聊套餐选型和实测体验。",
                        status: "",
                        highlights: [
                            "价格/限购提醒",
                            "选型与使用反馈"
                        ],
                        secondaryAction: {
                            text: "去 GitHub 讨论区",
                            url: "https://github.com/wmpeng/codingplan/discussions"
                        },
                        footnote: "扫码进飞书群，GitHub 可补充反馈。",
                        qrcode: "assets/feishu_group.png",
                        qrAlt: "飞书群二维码",
                        qrHint: "扫码即可进群"
                    },
                    usageCharts: {
                        valueYLog: true,
                        costXLog: true,
                        costYLog: true
                    }
                };
                window.appConfig = appConfig;
                try {
                    applyConfig();
                } catch (applyError) {
                    console.error('应用默认配置失败:', applyError);
                }
            }
        }

        // 应用配置
        function applyConfig() {
            window.appConfig = appConfig;
            if (appConfig.header) {
                const h = appConfig.header;
                document.title = `${h.title} - Coding Plan 对比工具`;
                document.getElementById('pageTitle').textContent = h.title;
                document.getElementById('updateDate').textContent = h.updateDate;
                document.getElementById('subtitle').innerHTML = (h.subtitle || '').replace(/\n/g, '<br>');
                document.getElementById('models').innerHTML = (h.models || '').replace(/\n/g, '<br>');
                
                if (h.entry || h.github) {
                    const entry = h.entry || h.github;
                    const headerEntryLink = document.getElementById('headerEntryLink');
                    const entryUrl = sanitizeHttpUrl(entry.url, 'https://github.com/wmpeng/codingplan/discussions');
                    headerEntryLink.href = entryUrl || 'https://github.com/wmpeng/codingplan/discussions';
                    const isExternal = /^https?:\/\//i.test(headerEntryLink.href);
                    if (isExternal) {
                        headerEntryLink.setAttribute('target', '_blank');
                        headerEntryLink.setAttribute('rel', 'noopener noreferrer');
                    } else {
                        headerEntryLink.removeAttribute('target');
                        headerEntryLink.removeAttribute('rel');
                    }
                    document.getElementById('headerEntryText').textContent = entry.text;
                }
            }

            if (appConfig.community) {
                renderCommunitySection(appConfig.community);
                renderFeedbackFloat(appConfig.community);
            } else {
                renderFeedbackFloat({});
            }

            // 渲染平台推荐（优先 recommendationGroups，兜底 recommendations）
            if (Array.isArray(appConfig.recommendationGroups) && appConfig.recommendationGroups.length > 0) {
                renderRecommendationGroups(appConfig.recommendationGroups);
            } else if (appConfig.recommendations && appConfig.recommendations.length > 0) {
                renderRecommendations(appConfig.recommendations);
            }

            // 渲染评分标准
            if (appConfig.ratingGuide) {
                document.getElementById('ratingGuide').textContent = appConfig.ratingGuide;
            }

            // 渲染底部说明（无有效数据时不覆盖 HTML 中的静态默认文案）
            if (Array.isArray(appConfig.notes) && appConfig.notes.length > 0) {
                renderNotesSection('notesSection', {
                    title: '💡 说明',
                    items: appConfig.notes,
                    renderItem: function(note) {
                        return escapeHtml(note);
                    }
                });
            }

            // 渲染更新日志
            if (Array.isArray(appConfig.updates) && appConfig.updates.length > 0) {
                renderUpdatesSection('updatesSection', {
                    title: '📝 更新日志',
                    updates: appConfig.updates,
                    renderDate: function(date) {
                        return escapeHtml(date);
                    },
                    renderItem: function(item) {
                        return escapeHtml(item);
                    }
                });
            }

            // 渲染账号出售区域
            if (appConfig.accountSale) {
                renderAccountSale(appConfig.accountSale);
            }

            window.dispatchEvent(new CustomEvent('codingplan:config-applied'));
        }

        // 渲染账号出售
        function renderAccountSale(sale) {
            const container = document.getElementById('accountSaleSection');
            if (!container) return;
            // accounts 为空时整块区域隐藏，避免出现空白 panel
            if (!sale.accounts || sale.accounts.length === 0) {
                container.style.display = 'none';
                return;
            }
            container.style.display = '';

            const accountsHtml = sale.accounts.map(acc => `
                <div class="account-card">
                    <div class="platform">${acc.platform}</div>
                    <div class="detail">${acc.detail}</div>
                    <span class="price-tag">${acc.price}</span>
                </div>
            `).join('');

            const contactHtml = sale.qrcode ? `
                <div class="contact-section">
                    <div class="contact-info">
                        <div class="label">感兴趣联系 ${sale.contact.label}</div>
                        <div class="wechat-id">${sale.contact.id}</div>
                    </div>
                    <img src="${sale.qrcode}" alt="微信二维码" class="contact-qrcode">
                </div>
            ` : `
                <div class="contact-section">
                    <div class="contact-info">
                        <div class="label">感兴趣联系 ${sale.contact.label}</div>
                        <div class="wechat-id">${sale.contact.id}</div>
                    </div>
                </div>
            `;

            container.innerHTML = `
                <h3>${sale.title}</h3>
                <div class="description">${sale.description}</div>
                <div class="account-cards">${accountsHtml}</div>
                ${contactHtml}
            `;
        }

        function renderCommunitySection(community) {
            const container = document.getElementById('communityHub');
            if (!container) return;

            const highlights = Array.isArray(community.highlights) ? community.highlights : [];
            const primaryAction = community.primaryAction || null;
            const secondaryAction = community.secondaryAction || null;
            const primaryUrl = sanitizeHttpUrl(primaryAction && primaryAction.url);
            const secondaryUrl = sanitizeHttpUrl(secondaryAction && secondaryAction.url);
            const qrSrc = typeof community.qrcode === 'string' ? community.qrcode.trim() : '';
            const hasQr = qrSrc.length > 0;

            function renderAction(action, url, className) {
                if (!action || !action.text) return '';
                if (!url) {
                    return `<span class="community-hub-badge">${escapeHtml(action.text)}</span>`;
                }

                const isExternal = /^https?:\/\//i.test(url);
                return `<a class="${className}" href="${escapeHtml(url)}"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(action.text)}</a>`;
            }

            container.innerHTML = `
                <div class="community-hub">
                    <div class="community-hub-copy">
                        <div class="hero-summary-kicker">${escapeHtml(community.eyebrow || '加入讨论')}</div>
                        <h2 class="hero-summary-title">${escapeHtml(community.title || '')}</h2>
                        <p class="hero-summary-body">${escapeHtml(community.description || '')}</p>
                        ${community.status ? `<p class="community-hub-status">${escapeHtml(community.status)}</p>` : ''}
                        ${highlights.length ? `<ul class="community-hub-highlights">${highlights.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
                        <div class="community-hub-actions">
                            ${renderAction(primaryAction, primaryUrl, 'community-hub-btn')}
                            ${renderAction(secondaryAction, secondaryUrl, 'community-hub-btn community-hub-btn--secondary')}
                        </div>
                        ${community.footnote ? `<div class="community-hub-footnote">${escapeHtml(community.footnote)}</div>` : ''}
                    </div>
                    <div class="community-hub-qr${hasQr ? '' : ' community-hub-qr--empty'}">
                        ${hasQr
                            ? `<img src="${escapeHtml(qrSrc)}" alt="${escapeHtml(community.qrAlt || '飞书群二维码')}" loading="lazy" decoding="async">`
                            : `<div class="community-hub-qr-placeholder">飞书群二维码补充后，这里会显示可直接扫码加入的群入口。</div>`}
                        ${community.qrHint ? `<p class="community-hub-qr-hint">${escapeHtml(community.qrHint)}</p>` : ''}
                    </div>
                </div>
            `;
        }

        function renderFeedbackFloat(community) {
            const triggerLabel = document.getElementById('feedbackFloatTriggerLabel');
            const githubText = document.getElementById('feedbackFloatGithubText');
            const githubLink = document.getElementById('feedbackFloatGithubLink');
            const feishuTitle = document.getElementById('feedbackFloatFeishuTitle');
            const feishuLink = document.getElementById('feedbackFloatFeishuLink');
            const feishuLinkLabelEl = document.getElementById('feedbackFloatFeishuLinkText');
            const qrImage = document.getElementById('feedbackFloatQr');
            if (!triggerLabel || !githubText || !githubLink || !feishuTitle || !feishuLink || !feishuLinkLabelEl || !qrImage) return;

            const feedback = appConfig.feedback || {};
            const github = feedback.github || feedback.dataIssue || {};
            const feishuEntry = feedback.feedbackEntry || {};
            const feishuGroup = feedback.group || {};

            const githubUrl = sanitizeHttpUrl(
                github.url || 'https://github.com/wmpeng/codingplan/discussions'
            );
            const feishuUrl = sanitizeHttpUrl(feishuEntry.url || '');
            const feishuTitleText = feishuGroup.title || '飞书讨论群';
            let feishuLinkLabel = feishuEntry.text || '点此加入';
            if (feishuLinkLabel === feishuTitleText) {
                feishuLinkLabel = '点此加入';
            }

            triggerLabel.textContent = feedback.triggerText || '反馈与用户群';
            githubText.textContent = github.text || 'Github 讨论';
            githubLink.href = githubUrl || 'https://github.com/wmpeng/codingplan/discussions';
            feishuTitle.textContent = feishuTitleText;
            feishuLinkLabelEl.textContent = feishuLinkLabel;
            feishuLink.href = feishuUrl || '#';
            if (!feishuUrl) {
                feishuLink.style.display = 'none';
            } else {
                feishuLink.style.display = '';
            }

            const qrSrc = typeof feishuGroup.qrImage === 'string' && feishuGroup.qrImage.trim()
                ? feishuGroup.qrImage.trim()
                : (typeof community?.qrcode === 'string' ? community.qrcode.trim() : '');
            if (qrSrc) {
                qrImage.src = qrSrc;
                qrImage.alt = feishuGroup.qrAlt || community.qrAlt || '飞书群二维码';
                qrImage.style.display = '';
            } else {
                qrImage.removeAttribute('src');
                qrImage.style.display = 'none';
            }
        }

        function initFeedbackFloat() {
            const floatRoot = document.getElementById('feedbackFloat');
            const trigger = document.getElementById('feedbackFloatTrigger');
            if (!floatRoot || !trigger) return;

            function setOpen(open) {
                floatRoot.classList.toggle('is-open', open);
                trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
            }

            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(!floatRoot.classList.contains('is-open'));
            });

            floatRoot.addEventListener('click', (event) => {
                event.stopPropagation();
            });

            document.addEventListener('click', () => setOpen(false));
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') setOpen(false);
            });
        }

        function formatRecommendationText(text) {
            if (text === null || text === undefined) return '';

            const linkPlaceholders = [];
            const withLinkPlaceholders = String(text).replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (match, label, url) => {
                const safeUrl = sanitizeHttpUrl(url);
                if (!safeUrl) return match;

                const placeholder = `__RECOMMENDATION_LINK_${linkPlaceholders.length}__`;
                linkPlaceholders.push(
                    `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
                );
                return placeholder;
            });

            let formatted = escapeHtml(withLinkPlaceholders);
            formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            formatted = formatted.replace(/__RECOMMENDATION_LINK_(\d+)__/g, (_, index) => {
                return linkPlaceholders[Number(index)] || '';
            });

            return formatted;
        }

        // 构建单张推荐卡片 HTML
        function buildRecommendationCardHtml(rec) {
            const stars = '⭐️'.repeat(rec.rating);
            const reasonsHtml = (rec.reasons || []).map(reason => {
                return `<li>${formatRecommendationText(reason)}</li>`;
            }).join('');

            // 优先使用配置中的 action；未配置时再按平台名匹配 plans.json 的链接
            const configuredUrl = sanitizeHttpUrl(rec && rec.action);
            const matchedPlan = Array.isArray(allPlans) ? allPlans.find(p => p.vendor === rec.name) : null;
            const matchedPlanUrl = matchedPlan ? sanitizeHttpUrl(matchedPlan.action) : null;
            const recommendationUrl = configuredUrl || matchedPlanUrl;
            const nameHtml = recommendationUrl
                ? `<a class="recommendation-name-link" href="${escapeHtml(recommendationUrl)}" target="_blank" rel="noopener noreferrer"><span class="recommendation-name">${escapeHtml(rec.name)}</span><svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>`
                : `<span class="recommendation-name">${escapeHtml(rec.name)}</span>`;

            return `
                <div class="recommendation-card">
                    <div class="card-watermark">${watermarkUrl}</div>
                    <div class="recommendation-header">
                        ${nameHtml}
                        <span class="recommendation-rating">${stars}</span>
                    </div>
                    <ul class="recommendation-reasons">
                        ${reasonsHtml}
                    </ul>
                </div>
            `;
        }

        // 渲染分组推荐
        function renderRecommendationGroups(groups) {
            const container = document.getElementById('recommendationGroups');
            if (!container) return;
            if (!Array.isArray(groups) || groups.length === 0) {
                container.innerHTML = '';
                return;
            }

            container.innerHTML = groups.map(group => {
                const title = escapeHtml(group.title || '');
                const subtitle = group.subtitle ? `<p class="recommendation-group-subtitle">${escapeHtml(group.subtitle)}</p>` : '';
                const items = Array.isArray(group.items) ? group.items : [];
                const cardsHtml = items.map(buildRecommendationCardHtml).join('');

                return `
                    <section class="recommendation-group">
                        <header class="recommendation-group-header">
                            <h3 class="recommendation-group-title">${title}</h3>
                            ${subtitle}
                        </header>
                        <div class="recommendations">
                            ${cardsHtml}
                        </div>
                    </section>
                `;
            }).join('');
        }

        // 渲染平台推荐（向后兼容：当 config 仅提供 recommendations 平铺数据时使用）
        function renderRecommendations(recommendations) {
            const container = document.getElementById('recommendationGroups');
            if (!container) return;
            if (!Array.isArray(recommendations) || recommendations.length === 0) return;

            const cardsHtml = recommendations.map(buildRecommendationCardHtml).join('');
            container.innerHTML = `
                <section class="recommendation-group recommendation-group--flat">
                    <div class="recommendations">
                        ${cardsHtml}
                    </div>
                </section>
            `;
        }

        // 处理价格数据：补全缺失值
        function processPrices(item, index) {
            // 转换价格为数字
            let firstMonthPrice = parseFloat(item.firstMonthPrice);
            let monthlyPrice = parseFloat(item.monthlyPrice);
            let quarterlyPrice = parseFloat(item.quarterlyPrice);
            let yearlyPrice = parseFloat(item.yearlyPrice);

            // 如果首月价格为 "-" 或 NaN，使用包月价格
            if (isNaN(firstMonthPrice) || item.firstMonthPrice === '-') {
                firstMonthPrice = monthlyPrice;
            }

            // 如果包季价格为 "-" 或 NaN，使用包月价格 * 3
            if (isNaN(quarterlyPrice) || item.quarterlyPrice === '-') {
                quarterlyPrice = monthlyPrice * 3;
            }

            // 如果包年价格为 "-" 或 NaN，使用包季价格 * 4
            if (isNaN(yearlyPrice) || item.yearlyPrice === '-') {
                yearlyPrice = quarterlyPrice * 4;
            }

            // 转换请求数：保留"未公开"和"无限制"，其他转换为数字
            const preserveString = (value) => {
                if (value === '未公开' || value === '无限制') {
                    return value;
                }
                const num = parseInt(value);
                return isNaN(num) ? 0 : num;
            };

            item.fiveHoursRequests = preserveString(item.fiveHoursRequests);
            item.weeklyRequests = preserveString(item.weeklyRequests);
            item.monthlyRequests = preserveString(item.monthlyRequests);

            return {
                ...item,
                tags: Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string') : [],
                firstMonthPrice,
                monthlyPrice,
                quarterlyPrice,
                yearlyPrice,
                originalIndex: index // 保存原始索引，用于恢复顺序
            };
        }

        const PLATFORM_DIMENSION_META = [
            { key: 'value', label: '性价比' },
            { key: 'stability', label: '稳定性' },
            { key: 'models', label: '模型覆盖' },
            { key: 'convenience', label: '使用便捷性' }
        ];

        function getPlatformCatalogConfig() {
            return appConfig.platformCatalog || {
                defaultSelectedTags: [],
                operationalTags: [],
                showDiscontinuedTag: '显示停售',
                showRushPurchaseTag: '显示需抢购',
                derivedTags: []
            };
        }

        async function loadPlatforms() {
            const response = await fetch(PLATFORMS_FILE_PATH, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`platforms.json load failed: HTTP ${response.status}`);
            }
            allPlatforms = await response.json();
            if (!Array.isArray(allPlatforms)) {
                throw new Error('platforms.json must be an array');
            }
            console.log(`成功加载 ${allPlatforms.length} 个平台`);
        }

        function togglePlatformTag(label) {
            const idx = platformSelectedLabels.indexOf(label);
            if (idx >= 0) {
                platformSelectedLabels = platformSelectedLabels.filter((item) => item !== label);
            } else {
                platformSelectedLabels = [...platformSelectedLabels, label];
            }
            renderPlatformTagBar();
            applyPlatformFilters();
        }

        function renderPlatformTagBar() {
            const bar = document.getElementById('platformTagBar');
            if (!bar) return;

            const cat = getPlatformCatalogConfig();
            const chips = [];

            for (const tag of cat.derivedTags || []) {
                const label = tag.label;
                const active = platformSelectedLabels.includes(label);
                chips.push(
                    `<button type="button" class="platform-tag-chip${active ? ' is-active' : ''}" data-platform-tag="${escapeHtml(label)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(label)}</button>`
                );
            }

            for (const label of cat.operationalTags || []) {
                const active = platformSelectedLabels.includes(label);
                chips.push(
                    `<button type="button" class="platform-tag-chip${active ? ' is-active' : ''}" data-platform-tag="${escapeHtml(label)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(label)}</button>`
                );
            }

            const discLabel = cat.showDiscontinuedTag || '显示停售';
            const discActive = platformShowDiscontinued;
            chips.push(
                `<button type="button" class="platform-tag-chip platform-tag-chip--discontinued${discActive ? ' is-active' : ''}" data-platform-discontinued="1" aria-pressed="${discActive ? 'true' : 'false'}">${escapeHtml(discLabel)}</button>`
            );

            const rushLabel = cat.showRushPurchaseTag || '显示需抢购';
            const rushActive = platformShowRushPurchase;
            chips.push(
                `<button type="button" class="platform-tag-chip platform-tag-chip--rush${rushActive ? ' is-active' : ''}" data-platform-show-rush="1" aria-pressed="${rushActive ? 'true' : 'false'}">${escapeHtml(rushLabel)}</button>`
            );

            bar.innerHTML = chips.join('');

            bar.querySelectorAll('[data-platform-tag]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    togglePlatformTag(btn.getAttribute('data-platform-tag'));
                });
            });

            bar.querySelectorAll('[data-platform-discontinued]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    platformShowDiscontinued = !platformShowDiscontinued;
                    renderPlatformTagBar();
                    applyPlatformFilters();
                });
            });

            bar.querySelectorAll('[data-platform-show-rush]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    platformShowRushPurchase = !platformShowRushPurchase;
                    renderPlatformTagBar();
                    applyPlatformFilters();
                });
            });
        }

        function buildPlatformCardHtml(platform) {
            return PlatformCatalog.buildPlatformCardHtml(platform, allPlans, {
                sanitizeUrl: typeof sanitizeHttpUrl === 'function' ? sanitizeHttpUrl : (u) => u
            });
        }

        function applyPlatformFilters() {
            const cat = getPlatformCatalogConfig();
            if (typeof PlatformCatalog === 'undefined') {
                console.error('PlatformCatalog is not loaded');
                return;
            }

            const filterOpts = {
                selectedLabels: platformSelectedLabels,
                showDiscontinued: platformShowDiscontinued,
                showRushPurchase: platformShowRushPurchase,
                derivedTags: cat.derivedTags || [],
                operationalTags: cat.operationalTags || [],
                showDiscontinuedLabel: cat.showDiscontinuedTag,
                showRushPurchaseLabel: cat.showRushPurchaseTag
            };

            const filtered = PlatformCatalog.filterPlatforms(allPlatforms, filterOpts);
            const totalVisible = PlatformCatalog.filterPlatforms(allPlatforms, {
                ...filterOpts,
                selectedLabels: []
            }).length;

            const grid = document.getElementById('platformCardGrid');
            const empty = document.getElementById('platformCatalogEmpty');
            const showingEl = document.getElementById('platformShowingCount');
            const totalEl = document.getElementById('platformTotalCount');

            if (grid) {
                grid.innerHTML = filtered.map(buildPlatformCardHtml).join('');
            }
            if (empty) {
                empty.hidden = filtered.length > 0;
            }
            if (showingEl) {
                showingEl.textContent = String(filtered.length);
            }
            if (totalEl) {
                totalEl.textContent = String(totalVisible);
            }

            sessionStorage.setItem('platformCatalogSelection', JSON.stringify({
                labels: platformSelectedLabels,
                showDiscontinued: platformShowDiscontinued,
                showRushPurchase: platformShowRushPurchase
            }));

            if (typeof PlatformDetail !== 'undefined' && PlatformDetail.isOpen()) {
                const openId = PlatformDetail.getOpenPlatformId();
                const stillVisible = filtered.some(p => p.id === openId);
                if (!stillVisible) PlatformDetail.close();
            }
        }

        function clearPlatformFilters() {
            platformSelectedLabels = [];
            platformShowDiscontinued = false;
            platformShowRushPurchase = false;
            // 写入空选择，刷新后保持清空；仅首次无 storage key 时才用 defaultSelectedTags
            sessionStorage.setItem('platformCatalogSelection', JSON.stringify({
                labels: [],
                showDiscontinued: false,
                showRushPurchase: false
            }));
            applyPlatformFilters();
            renderPlatformTagBar();
        }

        function togglePlansTableSection() {
            const section = document.getElementById('plansTableSection');
            const panel = document.getElementById('plansTableCollapsible');
            const btn = document.getElementById('plansTableToggle');
            if (!section || !panel || !btn) return;

            const collapsed = section.getAttribute('data-collapsed') === 'true';
            section.setAttribute('data-collapsed', collapsed ? 'false' : 'true');
            panel.hidden = !collapsed;
            btn.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
            btn.textContent = collapsed ? '收起套餐大表' : '展开套餐大表';
        }

        function focusVendorInPlansTable(vendorName) {
            const section = document.getElementById('plansTableSection');
            if (section && section.getAttribute('data-collapsed') === 'true') {
                togglePlansTableSection();
            }
            selectedVendors = new Set([vendorName]);
            tempSelectedVendors = new Set([vendorName]);
            document.querySelectorAll('#vendorCheckboxes input').forEach(cb => {
                cb.checked = cb.value === vendorName;
            });
            updateVendorCount();
            applyFilters();
            if (section && typeof section.scrollIntoView === 'function') {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        function initPlatformCatalog() {
            const cat = getPlatformCatalogConfig();
            const stored = sessionStorage.getItem('platformCatalogSelection');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    const rawLabels = Array.isArray(parsed.labels) ? parsed.labels : [];
                    platformSelectedLabels = rawLabels.filter((label) => label !== '无需抢购');
                    platformShowDiscontinued = !!parsed.showDiscontinued;
                    platformShowRushPurchase = !!parsed.showRushPurchase;
                } catch (_) {
                    platformSelectedLabels = [...(cat.defaultSelectedTags || [])];
                    platformShowDiscontinued = false;
                    platformShowRushPurchase = false;
                }
            } else {
                platformSelectedLabels = [...(cat.defaultSelectedTags || [])];
                platformShowDiscontinued = false;
                platformShowRushPurchase = false;
            }

            renderPlatformTagBar();
            applyPlatformFilters();

            const clearBtn = document.getElementById('platformClearFilters');
            if (clearBtn && !clearBtn.dataset.bound) {
                clearBtn.dataset.bound = '1';
                clearBtn.addEventListener('click', clearPlatformFilters);
            }
            const tableToggle = document.getElementById('plansTableToggle');
            if (tableToggle && !tableToggle.dataset.bound) {
                tableToggle.dataset.bound = '1';
                tableToggle.addEventListener('click', togglePlansTableSection);
            }

            window.clearPlatformFilters = clearPlatformFilters;
            window.togglePlansTableSection = togglePlansTableSection;
            window.focusVendorInPlansTable = focusVendorInPlansTable;

            if (typeof PlatformDetail !== 'undefined' && PlatformDetail && typeof PlatformDetail.init === 'function') {
                PlatformDetail.init({
                    getPlans: () => allPlans,
                    monitorApiBase: (window.MONITOR_CONFIG && window.MONITOR_CONFIG.apiBase) || 'https://api.dreamfree.space/vc',
                    onJumpPlansTable: focusVendorInPlansTable,
                    escapeHtml: typeof escapeHtml === 'function' ? escapeHtml : null
                });

                const grid = document.getElementById('platformCardGrid');
                if (grid && !grid.dataset.detailBound) {
                    grid.dataset.detailBound = '1';
                    grid.addEventListener('click', (e) => {
                        if (e.target.closest('a')) return;
                        const card = e.target.closest('.platform-card');
                        if (!card) return;
                        const id = card.getAttribute('data-platform-id');
                        const platform = allPlatforms.find(p => p.id === id);
                        if (platform) PlatformDetail.open(platform, { triggerEl: card });
                    });
                    grid.addEventListener('keydown', (e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        const card = e.target.closest('.platform-card');
                        if (!card || e.target.closest('a')) return;
                        e.preventDefault();
                        const id = card.getAttribute('data-platform-id');
                        const platform = allPlatforms.find(p => p.id === id);
                        if (platform) PlatformDetail.open(platform, { triggerEl: card });
                    });
                }
            }
        }

        // 加载套餐数据
        async function loadData() {
            try {
                const hasStaticRows = tableBody.querySelector('tr.plan-row');
                if (!hasStaticRows) {
                    tableBody.innerHTML = `
                    <tr>
                        <td colspan="18">
                            <div class="loading">加载数据中</div>
                        </td>
                    </tr>
                `;
                }

                const response = await fetch(PLANS_FILE_PATH, {
                    cache: 'no-store'
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const plansData = await response.json();
                allPlans = plansData.map((item, index) => processPrices(item, index));
                filteredPlans = [...allPlans];

                initFilters();
                initPriceSliders();
                initRequestSliders();
                updatePresetTagButtons();
                applyFilters();

                // 数据加载后重新渲染推荐卡片（此时 allPlans 已有数据，可匹配链接）
                if (Array.isArray(appConfig.recommendationGroups) && appConfig.recommendationGroups.length > 0) {
                    renderRecommendationGroups(appConfig.recommendationGroups);
                } else if (appConfig.recommendations && appConfig.recommendations.length > 0) {
                    renderRecommendations(appConfig.recommendations);
                }

                console.log(`成功加载 ${allPlans.length} 条套餐数据`);
            } catch (error) {
                console.error('加载数据失败:', error);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="18">
                            <div class="empty-state">
                                <div class="empty-state-icon">❌</div>
                                <div class="empty-state-text">数据加载失败</div>
                                <div class="empty-state-hint">请检查 JSON 文件路径: ${PLANS_FILE_PATH}</div>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }

        async function bootHomepage() {
            window.__codingplanBootStarted = true;
            try {
                if (typeof renderPageNav === 'function') {
                    renderPageNav('pageNavMount', {
                        activeKey: 'index',
                        settings: {
                            panelTitle: '显示设置',
                            ultraWideLabel: '超宽屏模式'
                        }
                    });
                }

                if (typeof initFeedbackFloat === 'function') {
                    initFeedbackFloat();
                }
                await loadConfig();
                window.__codingplanConfigLoaded = !!(window.appConfig && window.appConfig.platformCatalog);

                watermarkUrl = appConfig.header?.watermarkUrl || window.location.host;
                document.querySelectorAll('.table-watermark-line').forEach(el => {
                    el.textContent = watermarkUrl;
                });

                await Promise.all([loadData(), loadPlatforms()]);
                bindPlansTableInteractions();
                initPlatformCatalog();
                window.__codingplanCatalogReady = true;
            } catch (error) {
                window.__codingplanBootError = String(error && error.message ? error.message : error);
                console.error('首页启动失败:', error);
                try {
                    if (!allPlatforms.length) {
                        await loadPlatforms();
                    }
                    initPlatformCatalog();
                    window.__codingplanCatalogReady = true;
                } catch (catalogError) {
                    window.__codingplanBootError = String(catalogError && catalogError.message ? catalogError.message : catalogError);
                    console.error('平台目录兜底启动失败:', catalogError);
                }
            }
        }

        function scheduleHomepageBoot() {
            window.__codingplanBootScheduled = true;
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    void bootHomepage();
                });
            } else {
                void bootHomepage();
            }
        }

        scheduleHomepageBoot();

    
    window.updateTypeSelection = updateTypeSelection;
    window.updateVendorSelection = updateVendorSelection;
    window.updateModelSelection = updateModelSelection;
    window.resetVendorFilter = resetVendorFilter;
    window.resetTypeFilter = resetTypeFilter;
    window.resetModelFilter = resetModelFilter;
    window.resetTokenLimitFilter = resetTokenLimitFilter;
    window.resetFirstMonthPriceFilter = resetFirstMonthPriceFilter;
    window.applyFirstMonthPriceFilter = applyFirstMonthPriceFilter;
    window.resetMonthlyPriceFilter = resetMonthlyPriceFilter;
    window.applyMonthlyPriceFilter = applyMonthlyPriceFilter;
    window.resetQuarterlyPriceFilter = resetQuarterlyPriceFilter;
    window.applyQuarterlyPriceFilter = applyQuarterlyPriceFilter;
    window.resetYearlyPriceFilter = resetYearlyPriceFilter;
    window.applyYearlyPriceFilter = applyYearlyPriceFilter;
    window.resetFiveHoursRequestFilter = resetFiveHoursRequestFilter;
    window.applyFiveHoursRequestFilter = applyFiveHoursRequestFilter;
    window.resetWeeklyRequestFilter = resetWeeklyRequestFilter;
    window.applyWeeklyRequestFilter = applyWeeklyRequestFilter;
    window.resetMonthlyRequestFilter = resetMonthlyRequestFilter;
    window.applyMonthlyRequestFilter = applyMonthlyRequestFilter;
    window.closeAllDropdowns = closeAllDropdowns;
    window.applyFilters = applyFilters;
    window.resetAllFilters = resetAllFilters;
    window.bootHomepage = bootHomepage;
    window.scheduleHomepageBoot = scheduleHomepageBoot;
})();
