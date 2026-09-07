import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Check, ArrowLeft, X, FileText, Info, FolderOpen } from 'lucide-react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const steps = [
  { id: 1, title: 'Campaigns Type', subtitle: 'Choose a Method to Send the Campaign' },
  { id: 2, title: 'Import Numbers', subtitle: 'Enter WhatsApp Numbers' },
  { id: 3, title: 'Import File', subtitle: 'Add PDF Or Image' },
  { id: 4, title: 'Send Invitation', subtitle: 'Send Invitation' },
  { id: 5, title: 'Add Message', subtitle: 'Add Message' }
];

const NewCampaignWizard = () => {
  const [searchParams] = useSearchParams();
  const preselectedCustomer = searchParams.get('customer');
  const navigate = useNavigate();
  
  const [customers, setCustomers] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [importMethod, setImportMethod] = useState('csv');
  const [isScheduled, setIsScheduled] = useState(false);
  const [manualImportModalOpen, setManualImportModalOpen] = useState(false);
  const [campaignData, setCampaignData] = useState({
    customerId: preselectedCustomer || '',
    name: '',
    type: 'Send With Document',
    contacts: [],
    manualContactsText: '',
    file: null,
    existingFileUrl: '',
    pdfCustomization: [],
    customPdfName: '',
    messageTemplate: '',
    delayFrom: 2,
    delayTo: 10,
    scheduleDateTime: null
  });

  const { id } = useParams();
  const isEditing = !!id;

  useEffect(() => {
    if (isEditing) {
      axios.get(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}`)
        .then(res => {
          const campaign = res.data;
          setCampaignData(prev => ({
            ...prev,
            customerId: campaign.customerId?._id || campaign.customerId,
            name: campaign.name || '',
            type: campaign.type || 'Send With Document',
            contacts: campaign.contacts || [],
            manualContactsText: campaign.contacts?.map(c => `${c.name || ''},${c.number || ''},${c.var1 || ''},${c.var2 || ''},${c.var3 || ''},${c.var4 || ''},${c.var5 || ''}`).join('\n') || '',
            existingFileUrl: campaign.fileUrl || '',
            pdfCustomization: campaign.pdfCustomization || [],
            customPdfName: campaign.customPdfName || '',
            messageTemplate: campaign.messageTemplate || '',
            delayFrom: campaign.delayFrom || 2,
            delayTo: campaign.delayTo || 10,
            scheduleDateTime: campaign.scheduleDateTime || null
          }));
          if (campaign.scheduleDateTime) setIsScheduled(true);
        })
        .catch(err => console.error('Error fetching campaign for edit:', err));
    }
  }, [id, isEditing]);

  const parseManualText = (text) => {
    const lines = text.split('\n');
    const parsedContacts = [];
    
    let startIndex = 0;
    if (lines.length > 0 && (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('number'))) {
      startIndex = 1;
    }
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim()) {
        const parts = line.split(',').map(p => p.trim());
        parsedContacts.push({
          name: parts[0] || '',
          number: parts[1] || '',
          var1: parts[2] || '',
          var2: parts[3] || '',
          var3: parts[4] || '',
          var4: parts[5] || '',
          var5: parts[6] || ''
        });
      }
    }
    setCampaignData(prev => ({ ...prev, contacts: parsedContacts, manualContactsText: text }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const csv = XLSX.utils.sheet_to_csv(ws);
        parseManualText(csv);
      };
      reader.readAsBinaryString(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        parseManualText(text);
      };
      reader.readAsText(file);
    }
    e.target.value = null;
  };

  const saveManualImport = () => {
    parseManualText(campaignData.manualContactsText || '');
    setManualImportModalOpen(false);
  };

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/customers`)
      .then(res => {
        setCustomers(res.data);
        if (!preselectedCustomer && res.data.length > 0) {
          setCampaignData(prev => ({ ...prev, customerId: res.data[0]._id }));
        }
      })
      .catch(err => console.error('Error fetching customers:', err));
  }, [preselectedCustomer]);

  const nextStep = () => {
    if (currentStep === 1 && (!campaignData.name || campaignData.name.trim() === '')) {
      alert('Please enter a Campaign Name.');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 5));
  };
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  
  const handleSaveDraft = async () => {
    await submitCampaign('Drafted');
  };

  const handleSend = async () => {
    if (isScheduled) {
      await submitCampaign('Scheduled');
    } else {
      await submitCampaign('In-Process');
    }
  };

  const submitCampaign = async (status) => {
    if (!campaignData.customerId) {
      alert("Please select a customer first.");
      return;
    }

    try {
      let fileUrl = campaignData.existingFileUrl || null;
      if (campaignData.file) {
        // Upload via backend → R2 (avoids browser CORS issues with Cloudflare)
        const formData = new FormData();
        formData.append('file', campaignData.file);
        formData.append('customerId', campaignData.customerId);
        const uploadRes = await axios.post(`${import.meta.env.VITE_API_URL}/api/campaigns/upload-file`, formData);
        fileUrl = uploadRes.data.fileUrl; // R2 key stored in DB
      }

      let parsedContacts = campaignData.contacts; // Now using already parsed contacts

      const payload = {
        customerId: campaignData.customerId,
        name: campaignData.name || 'Untitled Campaign',
        type: campaignData.type,
        status: status,
        delayFrom: campaignData.delayFrom,
        delayTo: campaignData.delayTo,
        messageTemplate: campaignData.messageTemplate,
        customPdfName: campaignData.customPdfName,
        fileUrl: fileUrl,
        contacts: parsedContacts,
        pdfCustomization: campaignData.pdfCustomization
      };

      if (isEditing) {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}`, payload);
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/campaigns`, payload);
      }
      navigate('/campaigns');
    } catch (err) {
      console.error('Error saving campaign:', err);
      alert('Failed to save campaign');
    }
  };

  const downloadExampleFile = () => {
    const csvContent = "name,phone,var1,var2,var3,var4,var5\nRahul Sharma,919876543210,Aarav & Priya,Wedding,15 December 2026,7 PM,Royal Palace Jaipur\nNeha Patel,919876543211,Aarav & Priya,Mehendi,14 December 2026,4 PM,Royal Palace Jaipur\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'contact_sample_file.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/campaigns')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">New Campaign</h1>
        </div>
      </div>

      <div className="flex flex-1 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {/* Stepper Sidebar */}
        <div className="w-1/3 bg-gray-50 p-6 border-r border-gray-200">
          <div className="space-y-6">
            {steps.map((step) => {
              const isCompleted = currentStep > step.id;
              const isActive = currentStep === step.id;
              
              return (
                <div key={step.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm ${
                      isCompleted 
                        ? 'bg-[var(--color-primary)] text-white' 
                        : isActive 
                          ? 'bg-gray-200 text-gray-900 border-2 border-[var(--color-primary)]'
                          : 'bg-white border border-gray-300 text-gray-400'
                    }`}>
                      {isCompleted ? <Check size={16} /> : step.id}
                    </div>
                    {step.id !== steps.length && (
                      <div className={`w-0.5 h-12 mt-2 ${isCompleted ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`}></div>
                    )}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isActive ? 'text-gray-900' : isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>{step.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{step.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content Area */}
        <div className="w-2/3 flex flex-col">
          <div className="flex-1 p-8 overflow-y-auto">
            {currentStep === 1 && (
              <div className="space-y-6 max-w-xl mx-auto mt-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Customer</label>
                  <select 
                    value={campaignData.customerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="" disabled>Select a customer...</option>
                    {customers.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter Campaign Name" 
                    value={campaignData.name}
                    required
                    onChange={(e) => setCampaignData({...campaignData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[var(--color-primary)]" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Campaign Type</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 border p-4 rounded-lg cursor-pointer flex flex-col items-center justify-center text-center gap-2 transition-colors ${campaignData.type === 'Send With Document' ? 'border-[var(--color-primary)] bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="type" className="sr-only" checked={campaignData.type === 'Send With Document'} onChange={() => setCampaignData({...campaignData, type: 'Send With Document'})} />
                      <span className="font-medium text-gray-900">Send With Document</span>
                    </label>
                    <label className={`flex-1 border p-4 rounded-lg cursor-pointer flex flex-col items-center justify-center text-center gap-2 transition-colors ${campaignData.type === 'Only Message' ? 'border-[var(--color-primary)] bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="type" className="sr-only" checked={campaignData.type === 'Only Message'} onChange={() => setCampaignData({...campaignData, type: 'Only Message'})} />
                      <span className="font-medium text-gray-900">Only Message</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
            
            {currentStep === 2 && (
              <div className="max-w-4xl mx-auto mt-4">
                <div className="flex flex-col gap-6">
                  {/* Top Section */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-[#4c3963] text-lg">Import CSV/Excel File Or Manual Data</h3>
                      <p className="text-xs text-gray-500 mt-1 mb-4">Select the method for import contacts</p>
                      
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setManualImportModalOpen(true)}
                          className="bg-[#4c3963] text-white px-6 py-2 rounded-md font-medium text-sm hover:bg-opacity-90 transition-colors"
                        >
                          Manual Import
                        </button>
                        <button 
                          onClick={() => document.getElementById('csv-upload').click()}
                          className="bg-[#4c3963] text-white px-6 py-2 rounded-md font-medium text-sm relative hover:bg-opacity-90 transition-colors"
                        >
                          Import From File
                          <input 
                            type="file" 
                            id="csv-upload" 
                            className="hidden" 
                            accept=".csv, .txt, .xls, .xlsx"
                            onChange={handleFileUpload}
                          />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={downloadExampleFile}
                        className="border border-gray-300 text-gray-700 px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
                      >
                        Example <FileText size={16} />
                      </button>
                      <div className="relative group flex items-center">
                        <button className="text-gray-400 border border-gray-300 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-50 cursor-help focus:outline-none">
                          <Info size={16} />
                        </button>
                        
                        {/* Custom Tooltip */}
                        <div className="absolute opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 top-full right-0 mt-2 w-72 bg-[#4c3963] text-white text-xs rounded-lg p-3.5 shadow-xl z-50 font-medium leading-relaxed">
                          <p>
                            Download the Example file to see the exact column headers required (name, phone, var1, etc.) for importing contacts from Excel or CSV.
                          </p>
                          <div className="absolute -top-1.5 right-3 w-3 h-3 bg-[#4c3963] transform rotate-45"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table Section */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
                      <h3 className="font-bold text-gray-700 text-sm">Details</h3>
                      <div className="flex gap-3">
                        <button 
                          className="bg-[#6b5883] text-white px-6 py-1.5 rounded-md text-sm font-medium hover:bg-opacity-90"
                          onClick={() => setManualImportModalOpen(true)}
                        >
                          Edit
                        </button>
                        <button 
                          className="bg-red-50 text-red-500 px-4 py-1.5 rounded-md text-sm font-medium border border-red-100 hover:bg-red-100 transition-colors"
                          onClick={() => setCampaignData({...campaignData, contacts: [], manualContactsText: ''})}
                        >
                          Clear Data
                        </button>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto min-h-[400px] flex flex-col relative">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 text-[10px] text-[#4c3963] font-bold uppercase tracking-wider">
                            <th className="py-3 px-4">Name</th>
                            <th className="py-3 px-4">Number</th>
                            <th className="py-3 px-4 text-center">VAR1</th>
                            <th className="py-3 px-4 text-center">VAR2</th>
                            <th className="py-3 px-4 text-center">VAR3</th>
                            <th className="py-3 px-4 text-center">VAR4</th>
                            <th className="py-3 px-4 text-center">VAR5</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaignData.contacts && campaignData.contacts.length > 0 ? (
                            campaignData.contacts.map((c, i) => (
                              <tr key={i} className="border-b border-gray-50 text-xs font-medium text-gray-700 hover:bg-gray-50">
                                <td className="py-4 px-4">{c.name || '-'}</td>
                                <td className="py-4 px-4">{c.number || '-'}</td>
                                <td className="py-4 px-4 text-center">{c.var1 || '-'}</td>
                                <td className="py-4 px-4 text-center">{c.var2 || '-'}</td>
                                <td className="py-4 px-4 text-center">{c.var3 || '-'}</td>
                                <td className="py-4 px-4 text-center">{c.var4 || '-'}</td>
                                <td className="py-4 px-4 text-center">{c.var5 || '-'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="7">
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                  <div className="w-64 h-48 mb-4 flex flex-col items-center justify-center relative">
                                    <FolderOpen size={64} className="text-yellow-400 mb-2 drop-shadow-sm" />
                                    <div className="absolute right-12 bottom-12 w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-white font-bold rotate-12 shadow-sm">
                                      <X size={20} />
                                    </div>
                                    <div className="absolute left-4 top-12 border-t-2 border-l-2 border-yellow-200 w-24 h-16 rounded-tl-[40px] opacity-50"></div>
                                    <div className="absolute right-4 bottom-4 border-b-2 border-r-2 border-yellow-200 w-24 h-16 rounded-br-[40px] opacity-50"></div>
                                  </div>
                                  <p className="font-semibold text-gray-500 text-lg">No records to display.</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Manual Import Modal */}
                {manualImportModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full flex flex-col relative animate-fade-in-up">
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-[#4c3963]">Manual Import</h3>
                        <button onClick={() => setManualImportModalOpen(false)} className="text-gray-400 hover:text-gray-700 bg-gray-100 rounded-full p-1">
                          <X size={18} />
                        </button>
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-sm text-gray-600 font-medium">Enter numbers manually (one per line)</p>
                        <p className="text-xs text-gray-500 mt-1">Format: Name, Number, Var1, Var2, Var3, Var4, Var5</p>
                      </div>
                      
                      <textarea 
                        className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--color-primary)] font-mono text-sm leading-relaxed"
                        placeholder={`Radhika Merchant, 9946245623, Guest, VIP, None, None, None\nAnant Ambani, 9946245624, VIP, VIP, None, None, None`}
                        value={campaignData.manualContactsText}
                        onChange={(e) => setCampaignData({...campaignData, manualContactsText: e.target.value})}
                      ></textarea>
                      
                      <div className="flex justify-end gap-3 mt-6">
                        <button 
                          onClick={() => setManualImportModalOpen(false)}
                          className="px-6 py-2 text-gray-600 bg-gray-100 rounded-md font-medium text-sm hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={saveManualImport}
                          className="px-6 py-2 text-white bg-[#4c3963] rounded-md font-medium text-sm hover:bg-opacity-90 transition-colors"
                        >
                          Save & Parse
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {currentStep === 3 && (
              <div className="max-w-2xl mx-auto mt-8">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center text-center bg-gray-50">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                    <span className="text-gray-500">📄</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Upload Invitation Document</h3>
                  <p className="text-sm text-gray-500 mb-4">Upload a PDF or Image (JPG, PNG)</p>
                  
                  <input 
                    type="file" 
                    id="doc-upload" 
                    className="hidden" 
                    accept=".pdf, .jpg, .jpeg, .png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setCampaignData({...campaignData, file: e.target.files[0]});
                      }
                    }}
                  />
                  <label 
                    htmlFor="doc-upload"
                    className="bg-white border border-[#4c3963] text-[#4c3963] px-6 py-2 rounded-md hover:bg-purple-50 font-medium cursor-pointer inline-block"
                  >
                    Browse File
                  </label>
                  
                  {campaignData.file && (
                    <div className="mt-4 text-sm font-medium text-gray-700">
                      Selected: {campaignData.file.name}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {currentStep === 4 && (
              <div className="flex min-h-[600px] gap-6 mt-4 max-w-[1200px] mx-auto">
                
                {/* Left: Customize PDF Sidebar */}
                <div className="w-80 bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col h-fit">
                  <h3 className="font-bold text-[#4c3963] mb-6 text-lg">Customize PDF</h3>
                  
                  <div className="flex flex-col gap-4">
                    {['Name', 'Number', 'Var 1', 'Var 2', 'Var 3'].map(v => {
                       const activeItem = campaignData.pdfCustomization.find(item => item.variable === v);
                       const isActive = !!activeItem;
                       
                       return (
                         <div key={v} className="flex flex-col gap-3">
                           <div className={`flex justify-between items-center border rounded-lg px-4 py-3 transition-colors ${isActive ? 'border-[var(--color-primary)] bg-purple-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                             <span className="font-medium text-gray-700">{v}</span>
                             <div className="flex items-center gap-3">
                               <span className="text-xs text-gray-500 font-medium">Edit</span>
                               <button 
                                 onClick={() => {
                                   if (isActive) {
                                     setCampaignData({
                                       ...campaignData,
                                       pdfCustomization: campaignData.pdfCustomization.filter(item => item.variable !== v)
                                     });
                                   } else {
                                     setCampaignData({
                                       ...campaignData,
                                       pdfCustomization: [...campaignData.pdfCustomization, {
                                         id: Math.random().toString(36).substr(2, 9),
                                         variable: v,
                                         x: 50,
                                         y: 50,
                                         font: 'KAP 128',
                                         fontSize: 20,
                                         color: '#323232'
                                       }]
                                     });
                                   }
                                 }}
                                 className={`w-10 h-5 rounded-full relative transition-colors ${isActive ? 'bg-[#4c3963]' : 'bg-gray-200'}`}
                               >
                                 <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${isActive ? 'left-[22px]' : 'left-0.5'}`}></div>
                               </button>
                             </div>
                           </div>
                           
                           {isActive && (
                             <div className="px-1 pb-4 animate-fade-in-up">
                               <div className="mb-3">
                                 <label className="block text-xs font-medium text-gray-600 mb-1">Select Font</label>
                                 <select 
                                   className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:border-[var(--color-primary)]"
                                   value={activeItem.font}
                                   onChange={(e) => {
                                     const updated = campaignData.pdfCustomization.map(item => 
                                       item.variable === v ? { ...item, font: e.target.value } : item
                                     );
                                     setCampaignData({...campaignData, pdfCustomization: updated});
                                   }}
                                 >
                                   <option value="Arial">Arial</option>
                                   <option value="KAP 128">KAP 128</option>
                                   <option value="Times New Roman">Times New Roman</option>
                                   <option value="Helvetica">Helvetica</option>
                                 </select>
                               </div>
                               
                               <div className="flex gap-4">
                                 <div className="flex-1">
                                   <label className="block text-xs font-medium text-gray-600 mb-1">Font Size</label>
                                   <input 
                                     type="number" 
                                     className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:border-[var(--color-primary)]"
                                     value={activeItem.fontSize}
                                     onChange={(e) => {
                                       const updated = campaignData.pdfCustomization.map(item => 
                                         item.variable === v ? { ...item, fontSize: e.target.value } : item
                                       );
                                       setCampaignData({...campaignData, pdfCustomization: updated});
                                     }}
                                   />
                                 </div>
                                 <div className="flex-1">
                                   <label className="block text-xs font-medium text-gray-600 mb-1">Select Color</label>
                                   <div className="flex border border-gray-200 rounded-md overflow-hidden h-[38px] group focus-within:border-[var(--color-primary)]">
                                     <input 
                                       type="text" 
                                       className="w-full px-3 text-sm font-medium text-gray-700 focus:outline-none"
                                       value={activeItem.color}
                                       onChange={(e) => {
                                         const updated = campaignData.pdfCustomization.map(item => 
                                           item.variable === v ? { ...item, color: e.target.value } : item
                                         );
                                         setCampaignData({...campaignData, pdfCustomization: updated});
                                       }}
                                     />
                                     <div className="w-10 bg-[#6b5883] flex items-center justify-center relative cursor-pointer">
                                       <input 
                                         type="color" 
                                         className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                         value={activeItem.color}
                                         onChange={(e) => {
                                           const updated = campaignData.pdfCustomization.map(item => 
                                             item.variable === v ? { ...item, color: e.target.value } : item
                                           );
                                           setCampaignData({...campaignData, pdfCustomization: updated});
                                         }}
                                       />
                                       {/* Color picker icon mock */}
                                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                         <path d="M12 2l3 3-9 9-3 3 1-4 8-8z"></path>
                                         <path d="M16 6l2 2"></path>
                                       </svg>
                                     </div>
                                   </div>
                                 </div>
                               </div>
                             </div>
                           )}
                         </div>
                       );
                    })}
                  </div>
                </div>

                {/* Right: Canvas Area */}
                <div className="flex-1 bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col relative h-[650px]">
                  
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 text-lg">File Preview</h3>
                  </div>
                  
                  <div className="flex-1 flex gap-5 overflow-hidden">
                    {/* Main Preview */}
                    <div className="flex-1 bg-[#f8f9fa] border border-gray-200 rounded-lg relative overflow-hidden flex items-center justify-center shadow-inner">
                      {campaignData.file || campaignData.existingFileUrl ? (
                        <div 
                          className="relative inline-flex items-center justify-center max-w-full max-h-full shadow-sm"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData('drag-id');
                            if (!id) return;
                            
                            const rect = e.currentTarget.getBoundingClientRect();
                            let x = ((e.clientX - rect.left) / rect.width) * 100;
                            let y = ((e.clientY - rect.top) / rect.height) * 100;
                            
                            // clamp to 0-100
                            x = Math.max(0, Math.min(100, x));
                            y = Math.max(0, Math.min(100, y));
                            
                            const updated = campaignData.pdfCustomization.map(item => 
                              item.id === id ? { ...item, x, y } : item
                            );
                            setCampaignData({...campaignData, pdfCustomization: updated});
                          }}
                        >
                          {(() => {
                             const isPdf = campaignData.file ? campaignData.file.type.includes('pdf') : campaignData.existingFileUrl?.toLowerCase().endsWith('.pdf');
                             const previewUrl = campaignData.file 
                               ? URL.createObjectURL(campaignData.file)
                               : campaignData.existingFileUrl?.startsWith('http')
                                 ? campaignData.existingFileUrl
                                 : `${import.meta.env.VITE_CF_URL || 'https://assets.npjnxt.com'}/${campaignData.existingFileUrl}`;
                             
                             return isPdf ? (
                               <object data={previewUrl} type="application/pdf" className="max-w-full max-h-full pointer-events-none" />
                             ) : (
                               <img src={previewUrl} alt="Preview" className="max-w-full max-h-full pointer-events-none" />
                             );
                          })()}

                          <div className="absolute inset-0 z-0 pointer-events-none"></div>

                          {/* Render Variables (now draggable directly on canvas) */}
                          {campaignData.pdfCustomization.map(item => {
                            let displayValue = item.variable;
                            if (campaignData.contacts && campaignData.contacts.length > 0) {
                              const contact = campaignData.contacts[0];
                              const vMap = {
                                'Name': contact.name,
                                'Number': contact.number,
                                'Var 1': contact.var1,
                                'Var 2': contact.var2,
                                'Var 3': contact.var3,
                                'Var 4': contact.var4,
                                'Var 5': contact.var5
                              };
                              if (vMap[item.variable]) displayValue = vMap[item.variable];
                            }

                            return (
                              <div 
                                key={item.id} 
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('drag-id', item.id);
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  left: `${item.x}%`, 
                                  top: `${item.y}%`, 
                                  transform: 'translate(-50%, -50%)',
                                  fontSize: `${item.fontSize}px`,
                                  color: item.color,
                                  fontFamily: item.font
                                }}
                                className="absolute cursor-grab active:cursor-grabbing font-bold whitespace-nowrap z-10 select-none hover:outline hover:outline-2 hover:outline-dashed hover:outline-[var(--color-primary)] transition-all p-1"
                              >
                                {displayValue}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-400 font-medium">No Document Uploaded</span>
                      )}
                    </div>
                    
                    {/* Thumbnails Sidebar */}
                    <div className="w-24 flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar pb-4">
                      {[1, 2, 3, 4].map(idx => (
                        <div key={idx} className={`w-full h-32 bg-white rounded-md border-2 ${idx === 1 ? 'border-[var(--color-primary)] ring-2 ring-purple-100' : 'border-gray-200 hover:border-gray-300'} cursor-pointer overflow-hidden transition-all flex items-center justify-center shadow-sm`}>
                          {campaignData.file && !campaignData.file.type.includes('pdf') ? (
                            <img src={URL.createObjectURL(campaignData.file)} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                          ) : (
                             <span className="text-gray-400 text-xs font-medium">Page {idx}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {currentStep === 5 && (
              <div className="max-w-4xl mx-auto space-y-6 mt-4">
                
                {/* Block 1: Add Message */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-[#4c3963] text-lg">Add Message</h3>
                    <button 
                      onClick={() => setCampaignData({...campaignData, messageTemplate: ''})}
                      className="text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors rounded-md px-4 py-1.5 text-sm font-semibold"
                    >
                      Clear Data
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">Type your message to share with your Family ones.</p>
                  
                  
                  <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col focus-within:border-[var(--color-primary)] transition-colors shadow-sm">
                    <textarea 
                      className="w-full h-32 p-4 text-sm text-gray-700 focus:outline-none focus:bg-gray-50 transition-colors resize-none" 
                      placeholder="Please enter your massage"
                      value={campaignData.messageTemplate}
                      onChange={(e) => setCampaignData({...campaignData, messageTemplate: e.target.value})}
                    ></textarea>
                    <div className="bg-white border-t border-gray-100 p-3 flex justify-between items-center">
                      <div className="flex gap-2">
                        {['[[Name]]', '[[Var1]]', '[[Var2]]', '[[Var3]]', '[[Var4]]'].map(v => (
                          <button key={v} className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-600 hover:border-[#4c3963] hover:text-[#4c3963] transition-all shadow-sm">
                            {v}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-gray-500 px-2 cursor-pointer">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hover:text-gray-800"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                        <span className="font-serif font-bold text-lg leading-none hover:text-gray-800">B</span>
                        <span className="font-serif italic text-lg leading-none hover:text-gray-800">i</span>
                        <span className="line-through text-lg leading-none hover:text-gray-800">S</span>
                        <span className="underline text-lg leading-none hover:text-gray-800">U</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Block 2: Customize PDF Name */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <h3 className="font-bold text-[#4c3963] text-lg mb-6">Customize PDF Name</h3>
                  
                  <label className="block text-sm font-semibold text-gray-700 mb-2">PDF Name</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors mb-2 shadow-sm" 
                    placeholder="Enter PDF Name" 
                    value={campaignData.customPdfName}
                    onChange={(e) => setCampaignData({...campaignData, customPdfName: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mb-6 flex items-center gap-1 font-medium">
                    <Info size={14} className="text-gray-400" /> Your default PDF name will be invitation
                  </p>
                  
                  <button className="px-4 py-2 bg-white border border-gray-300 rounded text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
                    [[Name]]
                  </button>
                </div>

                {/* Block 3: Delay Second */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <h3 className="font-bold text-[#4c3963] text-lg mb-6">Delay Second</h3>
                  
                  <div className="flex gap-6 w-full max-w-lg">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">From</label>
                      <input 
                        type="number" 
                        value={campaignData.delayFrom} 
                        onChange={(e) => setCampaignData({...campaignData, delayFrom: e.target.value})}
                        className="w-full border border-gray-200 rounded-md px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[var(--color-primary)] transition-colors shadow-sm" 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">To</label>
                      <input 
                        type="number" 
                        value={campaignData.delayTo} 
                        onChange={(e) => setCampaignData({...campaignData, delayTo: e.target.value})}
                        className="w-full border border-gray-200 rounded-md px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[var(--color-primary)] transition-colors shadow-sm" 
                      />
                    </div>
                  </div>
                </div>

                {/* Block 4: Schedule Message */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <h3 className="font-bold text-[#4c3963] text-lg mb-6">Schedule Message</h3>
                  
                  <div className="bg-[#f0f2f8] rounded-lg p-3.5 flex items-center gap-4 transition-colors">
                    <div 
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors shadow-sm ${isScheduled ? 'bg-[#4c3963] border-[#4c3963]' : 'bg-white border-gray-300'}`}
                      onClick={() => setIsScheduled(!isScheduled)}
                    >
                      {isScheduled && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm font-bold text-gray-700 cursor-pointer select-none" onClick={() => setIsScheduled(!isScheduled)}>Schedule Campaign</span>
                  </div>
                  
                  {isScheduled && (
                    <div className="animate-fade-in-up">
                      <input 
                        type="datetime-local" 
                        className="w-full max-w-sm border border-[var(--color-primary)] bg-purple-50/30 rounded-md px-4 py-3 mt-4 focus:outline-none shadow-sm text-sm font-bold text-gray-700"
                        value={campaignData.scheduleDateTime || ''}
                        onChange={(e) => setCampaignData({...campaignData, scheduleDateTime: e.target.value})}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Action Footer */}
          <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-white mt-8 mx-6 mb-6 rounded-b-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
             {currentStep === 5 && (
               <>
                 <button className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-md font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
                   Test
                 </button>
                 <button onClick={handleSaveDraft} className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-md font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                   Save
                 </button>
               </>
             )}
             
             {currentStep > 1 && (
               <button onClick={prevStep} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-md font-bold text-sm flex items-center gap-2 hover:bg-gray-200 transition-colors ml-4">
                 &larr; Previous
               </button>
             )}
             
             {currentStep < 5 ? (
               <button onClick={nextStep} className="px-6 py-2.5 bg-[#3b2a50] text-white rounded-md font-bold text-sm hover:bg-[#2d1b4e] transition-colors flex items-center gap-2 shadow-md">
                 Next &rarr;
               </button>
             ) : (
               <button onClick={handleSend} className="px-6 py-2.5 bg-[#3b2a50] text-white rounded-md font-bold text-sm hover:bg-[#2d1b4e] transition-colors flex items-center gap-2 shadow-md">
                 Send &rarr;
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewCampaignWizard;
