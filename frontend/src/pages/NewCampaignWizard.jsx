import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Check, ArrowLeft, X, FileText, Info, FolderOpen, Loader2, Users, MessageSquare, Paperclip, Clock, Eye, ExternalLink } from 'lucide-react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Dropdown from '../components/Dropdown';
import PdfPreviewCanvas from '../components/PdfPreviewCanvas';
import PdfDocThumbnail from '../components/PdfDocThumbnail';

const steps = [
  { id: 1, title: 'Campaigns Type', subtitle: 'Choose a Method to Send the Campaign' },
  { id: 2, title: 'Import Numbers', subtitle: 'Enter WhatsApp Numbers' },
  { id: 3, title: 'Import File', subtitle: 'Add PDF Or Image' },
  { id: 4, title: 'Send Invitation', subtitle: 'Send Invitation' },
  { id: 5, title: 'Add Message', subtitle: 'Add Message' },
  { id: 6, title: 'Review & Confirm', subtitle: 'Review before sending' }
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
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
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

  const getAttachmentInfo = () => {
    if (campaignData.file) {
      const isPdf = campaignData.file.type?.includes('pdf') || campaignData.file.name?.toLowerCase().endsWith('.pdf');
      const url = URL.createObjectURL(campaignData.file);
      return {
        name: campaignData.file.name,
        size: `${(campaignData.file.size / 1024).toFixed(1)} KB`,
        url,
        isPdf
      };
    }
    if (campaignData.existingFileUrl) {
      const isPdf = campaignData.existingFileUrl.toLowerCase().includes('.pdf');
      const fullUrl = campaignData.existingFileUrl.startsWith('http')
        ? campaignData.existingFileUrl
        : `${import.meta.env.VITE_CF_URL || 'https://assets.npjnxt.com'}/${campaignData.existingFileUrl}`;
      const name = campaignData.existingFileUrl.split('/').pop() || 'Attached Document';
      return {
        name,
        size: 'Attached File',
        url: fullUrl,
        isPdf
      };
    }
    return null;
  };

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
        if (!isEditing && !preselectedCustomer && res.data.length > 0) {
          setCampaignData(prev => ({ ...prev, customerId: res.data[0]._id }));
        }
      })
      .catch(err => console.error('Error fetching customers:', err));
  }, [preselectedCustomer, isEditing]);

  // Per-step validation
  const validateStep = (step) => {
    const errors = {};

    if (step === 1) {
      if (!campaignData.customerId) errors.customerId = 'Please select a customer.';
      if (!campaignData.name || campaignData.name.trim() === '') errors.name = 'Campaign name is required.';
    }

    if (step === 2) {
      const validContacts = campaignData.contacts.filter(c => c.number && c.number.trim() !== '');
      if (validContacts.length === 0) errors.contacts = 'At least one contact with a valid number is required.';
    }

    if (step === 5) {
      if (!campaignData.messageTemplate || campaignData.messageTemplate.trim() === '') {
        errors.messageTemplate = 'Message template is required.';
      }
    }

    return errors;
  };

  const nextStep = () => {
    const errors = validateStep(currentStep);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    setCurrentStep(prev => Math.min(prev + 1, 6));
  };

  const prevStep = () => {
    setValidationErrors({});
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };
  
  const handleSaveDraft = async () => {
    // Drafts only require a customer and name
    if (!campaignData.customerId) {
      setValidationErrors({ customerId: 'Please select a customer.' });
      return;
    }
    if (!campaignData.name || campaignData.name.trim() === '') {
      setValidationErrors({ name: 'Campaign name is required.' });
      return;
    }
    setValidationErrors({});
    await submitCampaign('Drafted');
  };

  const handleSend = async () => {
    // Final validation before send
    const allErrors = {};
    for (let step = 1; step <= 5; step++) {
      Object.assign(allErrors, validateStep(step));
    }
    if (Object.keys(allErrors).length > 0) {
      setValidationErrors(allErrors);
      return;
    }
    setValidationErrors({});
    if (isScheduled) {
      await submitCampaign('Scheduled');
    } else {
      await submitCampaign('In-Process');
    }
  };

  const submitCampaign = async (status) => {
    if (isSubmitting) return; // Prevent double submission
    setIsSubmitting(true);

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
      setIsSubmitting(false);
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

  // Helper for the Review step
  const getCustomerName = () => {
    const cust = customers.find(c => c._id === campaignData.customerId);
    return cust?.name || 'Unknown';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/campaigns')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">{isEditing ? 'Edit Campaign' : 'New Campaign'}</h1>
        </div>
      </div>

      <div className="flex flex-1 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {/* Stepper Sidebar */}
        <div className="w-1/3 bg-gray-50 p-6 border-r border-gray-200">
          <div className="space-y-6">
            {steps.map((step) => {
              const isStepDone = (stepId) => {
                if (stepId === 1) return Boolean(campaignData.customerId && campaignData.name);
                if (stepId === 2) return Boolean(campaignData.contacts && campaignData.contacts.length > 0);
                if (stepId === 3) return Boolean(campaignData.file || campaignData.existingFileUrl);
                if (stepId === 4) return Boolean(campaignData.file || campaignData.existingFileUrl);
                if (stepId === 5) return Boolean(campaignData.messageTemplate);
                return false;
              };

              const isCompleted = step.id !== currentStep && (currentStep > step.id || isStepDone(step.id));
              const isActive = currentStep === step.id;
              
              return (
                <div 
                  key={step.id} 
                  onClick={() => {
                    setValidationErrors({});
                    setCurrentStep(step.id);
                  }}
                  className="flex gap-4 cursor-pointer p-2 -m-2 rounded-lg transition-all hover:bg-white/80 hover:shadow-2xs select-none group"
                >
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm transition-all ${
                      isActive 
                        ? 'bg-[var(--color-primary)] text-white shadow-sm ring-2 ring-purple-200'
                        : isCompleted 
                          ? 'bg-[var(--color-primary)] text-white' 
                          : 'bg-white border border-gray-300 text-gray-500 group-hover:border-[var(--color-primary)] group-hover:text-[var(--color-primary)]'
                    }`}>
                      {isCompleted && !isActive ? <Check size={16} /> : step.id}
                    </div>
                    {step.id !== steps.length && (
                      <div className={`w-0.5 h-12 mt-2 ${isCompleted ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`}></div>
                    )}
                  </div>
                  <div>
                    <h3 className={`font-semibold transition-colors ${
                      isActive 
                        ? 'text-[#4c3963] font-bold' 
                        : isCompleted 
                          ? 'text-gray-900 group-hover:text-[#4c3963]' 
                          : 'text-gray-500 group-hover:text-gray-900'
                    }`}>
                      {step.title}
                    </h3>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Customer <span className="text-red-500">*</span>
                  </label>
                  <Dropdown 
                    value={campaignData.customerId}
                    onChange={(val) => { setCampaignData({...campaignData, customerId: val}); setValidationErrors(prev => ({...prev, customerId: undefined})); }}
                    options={customers.map(c => ({ value: c._id, label: c.name }))}
                    placeholder="Select a customer..."
                  />
                  {validationErrors.customerId && (
                    <p className="text-red-500 text-xs mt-1 font-medium">{validationErrors.customerId}</p>
                  )}
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
                    onChange={(e) => { setCampaignData({...campaignData, name: e.target.value}); setValidationErrors(prev => ({...prev, name: undefined})); }}
                    className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:border-[var(--color-primary)] ${validationErrors.name ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {validationErrors.name && (
                    <p className="text-red-500 text-xs mt-1 font-medium">{validationErrors.name}</p>
                  )}
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

                  {/* Validation error */}
                  {validationErrors.contacts && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-2.5 rounded-lg">
                      {validationErrors.contacts}
                    </div>
                  )}

                  {/* Table Section */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-700 text-sm">Details</h3>
                        {campaignData.contacts && campaignData.contacts.length > 0 && (
                          <span className="bg-[#4c3963] text-white text-xs font-bold px-3 py-1 rounded-full">
                            Total: {campaignData.contacts.length}
                          </span>
                        )}
                      </div>
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
                    <div className="mt-6 flex flex-col items-center">
                      <div className="w-48 h-48 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm flex items-center justify-center relative group p-2">
                        <PdfDocThumbnail file={campaignData.file} />
                      </div>
                      <span className="mt-3 text-sm font-semibold text-[#4c3963] bg-white px-4 py-1.5 rounded-full shadow-sm border border-gray-200">
                        {campaignData.file.name}
                      </span>
                    </div>
                  )}

                  {campaignData.existingFileUrl && !campaignData.file && (
                    <div className="mt-6 flex flex-col items-center">
                      <div className="w-48 h-48 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm flex items-center justify-center relative group p-2">
                        <PdfDocThumbnail url={campaignData.existingFileUrl} />
                      </div>
                      <span className="mt-3 text-xs font-semibold text-[#4c3963] bg-purple-50 px-4 py-1.5 rounded-full border border-purple-200">
                        File saved in draft (Click 'Browse File' to replace)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {currentStep === 4 && (
              <div className="flex min-h-[600px] gap-6 mt-4 max-w-[1200px] mx-auto">
                
                {/* Left: Customize PDF Sidebar */}
                <div className="w-80 bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col h-fit shrink-0">
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
                <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col relative h-[650px] overflow-hidden">
                  <PdfPreviewCanvas
                    file={campaignData.file}
                    existingFileUrl={campaignData.existingFileUrl}
                    customizations={campaignData.pdfCustomization}
                    onUpdateCustomization={(updated) => {
                      setCampaignData(prev => ({ ...prev, pdfCustomization: updated }));
                    }}
                    contacts={campaignData.contacts}
                  />
                </div>
              </div>
            )}
            
            {currentStep === 5 && (
              <div className="max-w-4xl mx-auto space-y-6 mt-4">
                
                {/* Block 1: Add Message */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-[#4c3963] text-lg">Add Message <span className="text-red-500">*</span></h3>
                    <button 
                      onClick={() => setCampaignData({...campaignData, messageTemplate: ''})}
                      className="text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors rounded-md px-4 py-1.5 text-sm font-semibold"
                    >
                      Clear Data
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">Type your message to share with your Family ones.</p>
                  
                  
                  <div className={`border rounded-lg overflow-hidden flex flex-col focus-within:border-[var(--color-primary)] transition-colors shadow-sm ${validationErrors.messageTemplate ? 'border-red-400' : 'border-gray-200'}`}>
                    <textarea 
                      className="w-full h-32 p-4 text-sm text-gray-700 focus:outline-none focus:bg-gray-50 transition-colors resize-none" 
                      placeholder="Please enter your message"
                      value={campaignData.messageTemplate}
                      onChange={(e) => { setCampaignData({...campaignData, messageTemplate: e.target.value}); setValidationErrors(prev => ({...prev, messageTemplate: undefined})); }}
                    ></textarea>
                    <div className="bg-white border-t border-gray-100 p-3 flex justify-between items-center">
                      <div className="flex gap-2">
                        {['[[Name]]', '[[Var1]]', '[[Var2]]', '[[Var3]]', '[[Var4]]'].map(v => (
                          <button 
                            key={v} 
                            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-600 hover:border-[#4c3963] hover:text-[#4c3963] transition-all shadow-sm"
                            onClick={() => setCampaignData({...campaignData, messageTemplate: (campaignData.messageTemplate || '') + v})}
                          >
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
                  {validationErrors.messageTemplate && (
                    <p className="text-red-500 text-xs mt-2 font-medium">{validationErrors.messageTemplate}</p>
                  )}
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

            {/* Step 6: Review & Confirm */}
            {currentStep === 6 && (
              <div className="max-w-3xl mx-auto mt-4 space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-[#4c3963] mb-2">Review Your Campaign</h2>
                  <p className="text-gray-500 text-sm">Please review all details before sending.</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Campaign Info */}
                  <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[#4c3963] text-white flex items-center justify-center">
                        <MessageSquare size={16} />
                      </div>
                      <h4 className="font-bold text-[#4c3963] text-sm">Campaign Info</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Name</span>
                        <span className="font-semibold text-gray-800">{campaignData.name || 'Untitled'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Customer</span>
                        <span className="font-semibold text-gray-800">{getCustomerName()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Type</span>
                        <span className="font-semibold text-gray-800">{campaignData.type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Recipients */}
                  <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                        <Users size={16} />
                      </div>
                      <h4 className="font-bold text-blue-700 text-sm">Recipients</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Contacts</span>
                        <span className="font-bold text-2xl text-blue-700">{campaignData.contacts.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">With valid numbers</span>
                        <span className="font-semibold text-gray-800">
                          {campaignData.contacts.filter(c => c.number && c.number.trim()).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                        <Clock size={16} />
                      </div>
                      <h4 className="font-bold text-amber-700 text-sm">Schedule</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Mode</span>
                        <span className="font-semibold text-gray-800">{isScheduled ? 'Scheduled' : 'Send Now'}</span>
                      </div>
                      {isScheduled && campaignData.scheduleDateTime && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Date & Time</span>
                          <span className="font-semibold text-gray-800">
                            {new Date(campaignData.scheduleDateTime).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Delay</span>
                        <span className="font-semibold text-gray-800">{campaignData.delayFrom}s – {campaignData.delayTo}s</span>
                      </div>
                    </div>
                  </div>

                  {/* Attachment */}
                  <div className="bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center">
                          <Paperclip size={16} />
                        </div>
                        <h4 className="font-bold text-green-700 text-sm">Attachment</h4>
                      </div>
                      {getAttachmentInfo() && (
                        <button
                          type="button"
                          onClick={() => window.open(getAttachmentInfo().url, '_blank')}
                          className="text-xs text-green-700 hover:text-green-900 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                          title="Open in new window"
                        >
                          <ExternalLink size={12} />
                          <span>New Tab</span>
                        </button>
                      )}
                    </div>
                    <div className="text-sm">
                      {getAttachmentInfo() ? (
                        <div 
                          onClick={() => setAttachmentModalOpen(true)}
                          className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg shadow-2xs hover:border-green-400 hover:shadow-sm cursor-pointer transition-all group"
                          title="Click to preview attachment"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-gray-50 border border-gray-200 rounded-md overflow-hidden flex items-center justify-center shrink-0">
                              {getAttachmentInfo().isPdf ? (
                                <FileText size={22} className="text-red-500" />
                              ) : (
                                <img src={getAttachmentInfo().url} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-800 text-xs truncate group-hover:text-green-700 transition-colors">
                                {getAttachmentInfo().name}
                              </div>
                              <div className="text-gray-400 text-[10px]">{getAttachmentInfo().size}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-green-600 font-medium pl-2 shrink-0 group-hover:text-green-800">
                            <Eye size={14} />
                            <span className="hidden sm:inline">Preview</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-400 font-medium py-2 text-center text-xs">No file attached</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Message Preview */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <h4 className="font-bold text-[#4c3963] text-sm mb-3">Message Preview</h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto border border-gray-100">
                    {campaignData.messageTemplate 
                      ? (campaignData.messageTemplate.length > 500 
                          ? campaignData.messageTemplate.substring(0, 500) + '...' 
                          : campaignData.messageTemplate)
                      : <span className="text-gray-400 italic">No message set</span>
                    }
                  </div>
                </div>

                {/* Validation errors summary */}
                {Object.keys(validationErrors).length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h4 className="font-bold text-red-700 text-sm mb-2">Please fix the following:</h4>
                    <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                      {Object.values(validationErrors).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Action Footer */}
          <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-white mt-8 mx-6 mb-6 rounded-b-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
             {/* Save as Draft — available on every step */}
             <button 
               onClick={handleSaveDraft} 
               disabled={isSubmitting}
               className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-md font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : (
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
               )}
               Save as Draft
             </button>

             {currentStep === 6 && (
               <button className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-md font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
                 Test
               </button>
             )}
             
             {currentStep > 1 && (
               <button onClick={prevStep} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-md font-bold text-sm flex items-center gap-2 hover:bg-gray-200 transition-colors ml-4">
                 &larr; Previous
               </button>
             )}
             
             {currentStep < 6 ? (
               <button onClick={nextStep} className="px-6 py-2.5 bg-[#3b2a50] text-white rounded-md font-bold text-sm hover:bg-[#2d1b4e] transition-colors flex items-center gap-2 shadow-md">
                 Next &rarr;
               </button>
             ) : (
               <button 
                 onClick={handleSend} 
                 disabled={isSubmitting}
                 className="px-6 py-2.5 bg-[#3b2a50] text-white rounded-md font-bold text-sm hover:bg-[#2d1b4e] transition-colors flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isSubmitting ? (
                   <>
                     <Loader2 size={16} className="animate-spin" />
                     Sending...
                   </>
                 ) : (
                   <>Confirm & Send &rarr;</>
                 )}
               </button>
             )}
          </div>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      {attachmentModalOpen && getAttachmentInfo() && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setAttachmentModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0 font-bold">
                  {getAttachmentInfo().isPdf ? <FileText size={18} /> : <Paperclip size={18} />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-800 text-sm truncate">{getAttachmentInfo().name}</h3>
                  <span className="text-xs text-gray-400">{getAttachmentInfo().size}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.open(getAttachmentInfo().url, '_blank')}
                  className="px-3 py-1.5 bg-white text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-2xs"
                  title="Open in new window"
                >
                  <ExternalLink size={13} />
                  <span>Open in New Tab</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Preview */}
            <div className="flex-1 p-4 bg-[#f0f2f5] overflow-auto flex items-center justify-center min-h-[450px]">
              {getAttachmentInfo().isPdf ? (
                <iframe
                  src={getAttachmentInfo().url}
                  title="PDF Attachment Preview"
                  className="w-full h-[65vh] rounded-lg border border-gray-300 bg-white shadow-sm"
                />
              ) : (
                <img
                  src={getAttachmentInfo().url}
                  alt={getAttachmentInfo().name}
                  className="max-w-full max-h-[70vh] rounded-lg object-contain shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewCampaignWizard;
