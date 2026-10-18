import datetime, importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('package_mac_store',Path(__file__).with_name('package-mac-store.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ProfileTests(unittest.TestCase):
    def test_rejects_wrong_app_expired_and_development(self):
        now=datetime.datetime(2026,10,18)
        valid={'TeamIdentifier':['TEAM'], 'ExpirationDate':datetime.datetime(2027,1,1), 'DeveloperCertificates':[b'cert'], 'Entitlements':{'com.apple.application-identifier':'TEAM.io.example.radio'}}
        self.assertEqual(m.validate_profile(valid,'io.example.radio',now)[0],'TEAM')
        for change in [{'ExpirationDate':now},{'ProvisionedDevices':['device']},{'ProvisionsAllDevices':True},{'Entitlements':{'com.apple.application-identifier':'TEAM.io.example.radio','com.apple.security.get-task-allow':True}},{'Entitlements':{'com.apple.application-identifier':'TEAM.*'}},{'DeveloperCertificates':[]}]:
            with self.assertRaises(ValueError):m.validate_profile({**valid,**change},'io.example.radio',now)
if __name__=='__main__':unittest.main()
