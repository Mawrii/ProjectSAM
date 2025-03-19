# import unittest
# import requests

# class TestAPIMethods(unittest.TestCase):
    
#     def test_withdraw(self):
#         url = "http://145.23.224.208:8080/api/withdraw"
#         myobj = {"amount": 100}
#         params = {"target": "123456"}
#         response = requests.post(url, json=myobj, params=params)
#         self.assertEqual(response.status_code, 200)

#     def test_check_balance(self):
#         url = "http://145.23.224.208:8080/api/accountinfo"
#         myobj = {}
#         params = {"target": "12345"}
#         response = requests.post(url, json=myobj, params=params)
#         self.assertEqual(response.status_code, 200)



#     def test_health_check(self):
#         url = "http://145.23.224.208:8080/api/noob/health"
#         response = requests.get(url)
#         self.assertEqual(response.status_code, 200)

# if __name__ == "__main__":
#     unittest.main()

import requests
import json
import unittest

class testAPIWithdraw(unittest.TestCase):

    def test_server_health(self):
        url = "http://145.24.223.208:8080/api/noob/health"
        myobj = {"status":"OK"}
        response = requests.get(url, json = myobj)
        responseJSON = response.json()
        self.assertEqual("OK", responseJSON['status'])

    def test_check_pincode(self):
        url = "http://145.24.223.208:8080/api/accountinfo"
        params = {"target":"ZW00MASB1234561234"}
        myobj = {"uid": "50BC1DA8", "pincode": "1234"}
        response = requests.post(url, json=myobj, params=params)
        responseJSON = response.json()
        self.assertEqual("OK", responseJSON['status'])     
    



if __name__=='__main__':
    unittest.main()



