document.addEventListener('DOMContentLoaded', () => {
    const XLSX = window.XLSX;
    const dataGrid = document.getElementById('data-grid');
    const addRowBtn = document.getElementById('add-row-btn');
    const downloadBtn = document.getElementById('download-btn');
    const toastContainer = document.getElementById('toast-container');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadFile = document.getElementById('upload-file');
    const bulkLabelInput = document.getElementById('bulk-label-input');
    const bulkLabelBtn = document.getElementById('bulk-label-btn');

    // Add initial row
    addRow();

    // Event Listeners
    addRowBtn.addEventListener('click', addRow);
    downloadBtn.addEventListener('click', generateAndDownloadCSV);
    uploadBtn.addEventListener('click', () => uploadFile.click());
    uploadFile.addEventListener('change', handleFileUpload);
    
    bulkLabelBtn.addEventListener('click', () => {
        const labelVal = bulkLabelInput.value.trim();
        if (!labelVal) {
            showToast('일괄 적용할 라벨을 입력하세요.', 'error');
            return;
        }
        const rows = dataGrid.querySelectorAll('.grid-row');
        let count = 0;
        rows.forEach(row => {
            const labelInput = row.querySelector('.input-label');
            if (labelInput) {
                labelInput.value = labelVal;
                count++;
            }
        });
        showToast(`${count}개 행에 라벨 일괄 적용 완료`);
    });
    
    // Delegate paste event on the data grid
    dataGrid.addEventListener('paste', handlePaste);

    function createRow(name = '', phone = '', label = '') {
        const row = document.createElement('div');
        row.className = 'grid-row';
        
        row.innerHTML = `
            <input type="text" class="input-name" placeholder="홍길동" value="${name}">
            <input type="text" class="input-phone" placeholder="010-0000-0000" value="${phone}">
            <input type="text" class="input-label" placeholder="친구, 가족, 직장" value="${label}">
            <button class="btn-icon remove-row-btn" title="행 삭제">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        `;

        const removeBtn = row.querySelector('.remove-row-btn');
        removeBtn.addEventListener('click', () => {
            if (dataGrid.children.length > 1) {
                row.remove();
            } else {
                showToast('최소 1개의 행이 필요합니다.', 'error');
            }
        });

        // Add keyboard navigation
        const inputs = row.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && input.classList.contains('input-label')) {
                    const currentRowIndex = Array.from(dataGrid.children).indexOf(row);
                    if (currentRowIndex === dataGrid.children.length - 1) {
                        addRow();
                        dataGrid.lastElementChild.querySelector('.input-name').focus();
                    }
                }
            });
        });

        return row;
    }

    function addRow() {
        const row = createRow();
        dataGrid.appendChild(row);
        // Scroll to bottom
        dataGrid.scrollTop = dataGrid.scrollHeight;
    }

    function handlePaste(e) {
        // Find the input element that triggered the paste
        const target = e.target;
        if (target.tagName !== 'INPUT') return;

        // Prevent default paste behavior
        e.preventDefault();

        // Get pasted data via clipboard API
        let paste = (e.clipboardData || window.clipboardData).getData('text');
        
        // Remove trailing newlines
        paste = paste.trimEnd();
        
        if (!paste) return;

        // Split data into rows and columns
        const rows = paste.split(/\r\n|\n|\r/);
        
        // Find which row we are pasting into
        const currentRow = target.closest('.grid-row');
        const rowIndex = Array.from(dataGrid.children).indexOf(currentRow);
        
        // Find which column we are pasting into (0: name, 1: phone, 2: label)
        const inputs = Array.from(currentRow.querySelectorAll('input'));
        const colIndex = inputs.indexOf(target);

        let rowAdded = 0;

        rows.forEach((rowData, i) => {
            const cols = rowData.split('\t');
            
            // Current target row to fill
            let targetGridRow = dataGrid.children[rowIndex + i];
            
            // If we run out of rows, add a new one
            if (!targetGridRow) {
                targetGridRow = createRow();
                dataGrid.appendChild(targetGridRow);
                rowAdded++;
            }

            const targetInputs = targetGridRow.querySelectorAll('input');
            
            // Fill columns starting from the colIndex
            cols.forEach((colData, j) => {
                if (colIndex + j < targetInputs.length) {
                    targetInputs[colIndex + j].value = colData.trim();
                }
            });
        });

        showToast(`${rows.length}행의 데이터가 붙여넣기 되었습니다.`);
    }

    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                // 첫 번째 시트 선택
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // 데이터를 2차원 배열 형태로 가져오기
                const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
                
                if (!rows || rows.length === 0) {
                    showToast('파일에 데이터가 없습니다.', 'error');
                    return;
                }

                let nameIdx = 0;
                let phoneIdx = 1;
                let startIndex = 0;

                // 1. 헤더 행 찾기 로직 (최대 10행까지만 검사)
                let headerFound = false;
                for (let r = 0; r < Math.min(rows.length, 10); r++) {
                    const row = rows[r];
                    if (!row) continue;
                    
                    let tempNameIdx = -1;
                    let tempPhoneIdx = -1;

                    row.forEach((cell, idx) => {
                        if (!cell) return;
                        const str = String(cell).toLowerCase().replace(/\s+/g, '');
                        
                        // 한국 실정에 맞는 폭넓은 이름/연락처 키워드 지원
                        if (['이름', '성명', '성함', 'name', 'firstname', 'lastname', '고객명', '담당자', '수취인', '수령인', '회원명', '참여자', '학생', '원생', '보호자', '지원자', '참가자'].some(k => str.includes(k))) {
                            tempNameIdx = idx;
                        } else if (['연락처', '전화번호', '휴대폰', '번호', 'phone', 'mobile', 'tel', '핸드폰', '연락'].some(k => str.includes(k))) {
                            tempPhoneIdx = idx;
                        }
                    });

                    // 관련 키워드를 하나라도 찾았으면 헤더 행으로 간주
                    if (tempNameIdx !== -1 || tempPhoneIdx !== -1) {
                        headerFound = true;
                        startIndex = r + 1;
                        if (tempNameIdx !== -1) nameIdx = tempNameIdx;
                        if (tempPhoneIdx !== -1) phoneIdx = tempPhoneIdx;
                        break;
                    }
                }

                // 2. 헤더를 못 찾은 경우 데이터 패턴 분석 (Data Sniffing)
                if (!headerFound) {
                    startIndex = 0; // 헤더가 없으므로 첫 행부터 데이터로 간주
                    let phoneDetectedIdx = -1;
                    let nameDetectedIdx = -1;

                    for (let r = 0; r < Math.min(rows.length, 5); r++) {
                        const row = rows[r];
                        if (!row) continue;

                        row.forEach((cell, idx) => {
                            if (!cell) return;
                            const str = String(cell).trim();
                            // 전화번호 패턴 (010-1234-5678, 01012345678 등)
                            if (/^(01[016789]|02|0[3-9][0-9])[-\s]?\d{3,4}[-\s]?\d{4}$/.test(str)) {
                                if (phoneDetectedIdx === -1) phoneDetectedIdx = idx;
                            }
                            // 한국인 이름 패턴 (2~5자 한글)
                            else if (/^[가-힣]{2,5}$/.test(str)) {
                                if (nameDetectedIdx === -1) nameDetectedIdx = idx;
                            }
                        });
                        
                        if (phoneDetectedIdx !== -1 && nameDetectedIdx !== -1) break;
                    }

                    if (nameDetectedIdx !== -1 || phoneDetectedIdx !== -1) {
                        nameIdx = nameDetectedIdx !== -1 ? nameDetectedIdx : 0;
                        phoneIdx = phoneDetectedIdx !== -1 ? phoneDetectedIdx : 1;
                    } else {
                        // 최후의 수단: A열=이름, B열=연락처
                        nameIdx = 0;
                        phoneIdx = 1;
                    }
                }

                let validCount = 0;
                for (let i = startIndex; i < rows.length; i++) {
                    const rowData = rows[i];
                    if (!rowData || rowData.length === 0) continue;
                    
                    // 빈 행 스킵
                    const isEmpty = rowData.every(cell => cell === null || cell === undefined || cell === '');
                    if (isEmpty) continue;

                    const name = rowData[nameIdx] ? String(rowData[nameIdx]).trim() : '';
                    const phone = rowData[phoneIdx] ? String(rowData[phoneIdx]).trim() : '';
                    const label = ''; // 라벨 자동 매핑 제거, 빈 값 유지

                    if (name || phone || label) {
                        const row = createRow(name, phone, label);
                        dataGrid.appendChild(row);
                        validCount++;
                    }
                }

                if (validCount > 0) {
                    showToast(`${validCount}개의 연락처를 불러왔습니다.`);
                    dataGrid.scrollTop = dataGrid.scrollHeight;
                } else {
                    showToast('유효한 데이터가 없습니다.', 'error');
                }
            } catch (error) {
                console.error(error);
                showToast('파일을 읽는 중 오류가 발생했습니다.', 'error');
            }
            
            uploadFile.value = '';
        };
        
        reader.readAsArrayBuffer(file);
    }

    function generateAndDownloadCSV() {
        // Collect data
        const rows = Array.from(dataGrid.children);
        let validDataCount = 0;
        
        // Google Contacts CSV Headers
        const headers = ['Name', 'Phone 1 - Type', 'Phone 1 - Value', 'Group Membership'];
        let csvContent = headers.join(',') + '\n';

        rows.forEach(row => {
            const name = row.querySelector('.input-name').value.trim();
            const phone = row.querySelector('.input-phone').value.trim();
            const label = row.querySelector('.input-label').value.trim();

            if (name || phone || label) {
                validDataCount++;
                
                // Escape quotes
                const escapeCSV = (str) => `"${str.replace(/"/g, '""')}"`;
                
                const csvRow = [
                    escapeCSV(name),
                    'Mobile', // Default to Mobile for Phone 1 - Type
                    escapeCSV(phone),
                    escapeCSV(label)
                ];
                
                csvContent += csvRow.join(',') + '\n';
            }
        });

        if (validDataCount === 0) {
            showToast('입력된 데이터가 없습니다.', 'error');
            return;
        }

        // Add BOM for Excel compatibility with UTF-8
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        // Generate filename with date
        const date = new Date();
        const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        link.setAttribute('download', `google_contacts_${dateStr}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`${validDataCount}개의 연락처 CSV 다운로드 완료`);
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        
        const icon = type === 'success' 
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ef4444"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
            
        toast.innerHTML = `
            ${icon}
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
});
