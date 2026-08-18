import { Routes, Route } from 'react-router-dom';
import AllCampaigns from './AllCampaigns';
import CampaignDetails from './CampaignDetails';
import NewCampaignWizard from './NewCampaignWizard';

const Campaigns = () => {
  return (
    <Routes>
      <Route path="/" element={<AllCampaigns />} />
      <Route path="new" element={<NewCampaignWizard />} />
      <Route path="edit/:id" element={<NewCampaignWizard />} />
      <Route path=":id" element={<CampaignDetails />} />
    </Routes>
  );
};

export default Campaigns;
