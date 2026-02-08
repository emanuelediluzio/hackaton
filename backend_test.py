#!/usr/bin/env python3
import requests
import json
import sys
import time
from datetime import datetime

class VirtueFoundationAPITester:
    def __init__(self, base_url="https://f91285f2-1ee7-401d-8ea3-0f3be5d4caca.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED {details}")
        else:
            self.failed_tests.append({"test": test_name, "details": details})
            print(f"❌ {test_name}: FAILED {details}")

    def run_api_test(self, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            content = response.text[:200] if response.text else ""
            
            try:
                json_response = response.json() if response.content else {}
            except:
                json_response = {}

            return success, json_response, response.status_code, content

        except Exception as e:
            return False, {}, 0, str(e)

    def test_health_endpoint(self):
        """Test health endpoint with features list"""
        print(f"\n🔍 Testing Health Endpoint...")
        success, response, status, content = self.run_api_test('GET', '/api/health', 200)
        
        if success:
            faiss_size = response.get('faiss_index_size', 0)
            features = response.get('features', [])
            expected_features = ['sentence-transformers', 'mlflow', 'text2sql', 'multi-turn-memory']
            
            features_check = all(feat in features for feat in expected_features)
            
            if faiss_size > 0 and features_check:
                self.log_result("Health endpoint", True, f"faiss_size={faiss_size}, features={features}")
            else:
                self.log_result("Health endpoint", False, f"faiss_size={faiss_size}, features={features}, expected={expected_features}")
        else:
            self.log_result("Health endpoint", False, f"Status: {status}, Content: {content}")

    def test_facilities_api(self):
        """Test facilities API"""
        print(f"\n🔍 Testing Facilities API...")
        
        # Basic facilities endpoint
        success, response, status, content = self.run_api_test('GET', '/api/facilities', 200)
        if success and isinstance(response, list):
            facility_count = len(response)
            self.log_result("Facilities API", True, f"Returned {facility_count} facilities")
        else:
            self.log_result("Facilities API", False, f"Status: {status}, Content: {content}")
            return

        # Facilities with region filter
        success, response, status, content = self.run_api_test('GET', '/api/facilities?region=Northern', 200)
        if success and isinstance(response, list):
            northern_count = len(response)
            self.log_result("Facilities API with region filter", True, f"Returned {northern_count} Northern region facilities")
        else:
            self.log_result("Facilities API with region filter", False, f"Status: {status}, Content: {content}")

    def test_stats_api(self):
        """Test stats API returns 3530 facilities"""
        print(f"\n🔍 Testing Stats API...")
        success, response, status, content = self.run_api_test('GET', '/api/analysis/stats', 200)
        
        if success:
            total_facilities = response.get('total_facilities', 0)
            
            if total_facilities == 3530:
                self.log_result("Stats API", True, f"total_facilities={total_facilities}")
            else:
                self.log_result("Stats API", False, f"Expected 3530 facilities, got {total_facilities}")
        else:
            self.log_result("Stats API", False, f"Status: {status}, Content: {content}")

    def test_medical_deserts_api(self):
        """Test medical deserts analysis API"""
        print(f"\n🔍 Testing Medical Deserts API...")
        success, response, status, content = self.run_api_test('GET', '/api/analysis/medical-deserts', 200)
        
        if success and isinstance(response, list):
            desert_regions = len(response)
            self.log_result("Medical Deserts API", True, f"Returned analysis for {desert_regions} regions")
            
            # Check for expected structure
            if response and 'region' in response[0] and 'desert_score' in response[0]:
                self.log_result("Medical Deserts API structure", True, "Contains region and desert_score fields")
            else:
                self.log_result("Medical Deserts API structure", False, "Missing expected fields")
        else:
            self.log_result("Medical Deserts API", False, f"Status: {status}, Content: {content}")

    def test_multi_turn_memory(self):
        """Test multi-turn chat memory"""
        print(f"\n🔍 Testing Multi-turn Memory...")
        session_id = "test_multi_turn_session"
        
        # First message
        test_data1 = {
            "message": "What hospitals are in Northern region?",
            "session_id": session_id
        }
        
        success1, response1, status1, content1 = self.run_api_test('POST', '/api/chat', 200, test_data1)
        
        if not success1:
            self.log_result("Multi-turn Memory (first message)", False, f"Status: {status1}, Content: {content1}")
            return
        
        # Wait a moment for the conversation to be stored
        time.sleep(2)
        
        # Second message in same session
        test_data2 = {
            "message": "How many beds do they have in total?",
            "session_id": session_id
        }
        
        success2, response2, status2, content2 = self.run_api_test('POST', '/api/chat', 200, test_data2)
        
        if success2:
            reasoning_steps = response2.get('reasoning_steps', [])
            memory_step = None
            
            # Look for memory retrieval step
            for step in reasoning_steps:
                if 'Memory Retrieval' in step.get('action', '') and '1 previous conversation turns' in step.get('detail', ''):
                    memory_step = step
                    break
            
            if memory_step:
                self.log_result("Multi-turn Memory", True, "Found 'Loaded 1 previous conversation turns' in reasoning steps")
            else:
                self.log_result("Multi-turn Memory", False, "Did not find memory retrieval with '1 previous conversation turns'")
        else:
            self.log_result("Multi-turn Memory (second message)", False, f"Status: {status2}, Content: {content2}")

    def test_text2sql_api(self):
        """Test Text2SQL API"""
        print(f"\n🔍 Testing Text2SQL API...")
        test_data = {
            "query": "Find teaching hospitals with more than 500 beds"
        }
        
        success, response, status, content = self.run_api_test('POST', '/api/text2sql', 200, test_data)
        
        if success:
            has_mongo_query = 'mongo_query' in response
            has_results = 'results' in response
            has_explanation = 'explanation' in response
            
            if has_mongo_query and has_results and has_explanation:
                result_count = len(response.get('results', []))
                self.log_result("Text2SQL API", True, f"mongo_query, results ({result_count} items), and explanation present")
            else:
                self.log_result("Text2SQL API", False, f"Missing fields: mongo_query={has_mongo_query}, results={has_results}, explanation={has_explanation}")
        else:
            self.log_result("Text2SQL API", False, f"Status: {status}, Content: {content}")

    def test_mlflow_runs_api(self):
        """Test MLFlow runs API"""
        print(f"\n🔍 Testing MLFlow Runs API...")
        success, response, status, content = self.run_api_test('GET', '/api/mlflow/runs', 200)
        
        if success:
            if isinstance(response, list):
                run_count = len(response)
                
                # Check if any runs have metrics
                has_metrics = False
                if response:
                    for run in response:
                        if 'metrics' in run and run['metrics']:
                            has_metrics = True
                            break
                
                if has_metrics:
                    self.log_result("MLFlow Runs API", True, f"Returned {run_count} runs with metrics")
                else:
                    self.log_result("MLFlow Runs API", False, f"Returned {run_count} runs but no metrics found")
            else:
                self.log_result("MLFlow Runs API", False, f"Expected list, got {type(response)}")
        else:
            self.log_result("MLFlow Runs API", False, f"Status: {status}, Content: {content}")

    def test_chat_rag_api(self):
        """Test Chat RAG API with citations, reasoning steps, and MLFlow run ID"""
        print(f"\n🔍 Testing Chat RAG API...")
        test_data = {
            "message": "Which regions are medical deserts?",
            "session_id": "test_session_1"
        }
        
        success, response, status, content = self.run_api_test('POST', '/api/chat', 200, test_data)
        
        if success:
            has_response = 'response' in response and len(response['response']) > 0
            has_citations = 'citations' in response and len(response['citations']) == 5
            has_reasoning = 'reasoning_steps' in response and len(response['reasoning_steps']) == 5
            has_mlflow_id = 'mlflow_run_id' in response and response['mlflow_run_id'] is not None
            
            # Check reasoning steps contain expected actions
            reasoning_actions = [step.get('action', '') for step in response.get('reasoning_steps', [])]
            has_semantic_search = any('Semantic Search' in action for action in reasoning_actions)
            has_memory_retrieval = any('Memory Retrieval' in action for action in reasoning_actions)
            
            if has_response and has_citations and has_reasoning and has_mlflow_id and has_semantic_search and has_memory_retrieval:
                self.log_result("Chat RAG API", True, f"5 citations, 5 reasoning steps, mlflow_run_id present, semantic search + memory retrieval")
            else:
                details = f"response={has_response}, citations={has_citations}, reasoning={has_reasoning}, mlflow_id={has_mlflow_id}, semantic_search={has_semantic_search}, memory_retrieval={has_memory_retrieval}"
                self.log_result("Chat RAG API", False, details)
        else:
            self.log_result("Chat RAG API", False, f"Status: {status}, Content: {content}")

    def test_planning_api(self):
        """Test Planning API"""
        print(f"\n🔍 Testing Planning API...")
        test_data = {
            "region": "Northern",
            "specialty": "Surgery"
        }
        
        success, response, status, content = self.run_api_test('POST', '/api/planning/generate', 200, test_data)
        
        if success:
            has_plan = 'plan_text' in response
            has_id = 'plan_id' in response
            
            if has_plan and has_id:
                self.log_result("Planning API", True, f"Generated plan with ID: {response.get('plan_id', 'N/A')}")
            else:
                self.log_result("Planning API", False, f"Missing fields: plan_text={has_plan}, plan_id={has_id}")
        else:
            self.log_result("Planning API", False, f"Status: {status}, Content: {content}")

    def create_test_session(self):
        """Create test session in MongoDB for auth testing"""
        print(f"\n🔧 Creating test session...")
        import subprocess
        
        try:
            # Create test user and session using mongosh
            script = """
            use('virtue_foundation_idp');
            var userId = 'test-user-' + Date.now();
            var sessionToken = 'test_session_' + Date.now();
            var result = db.users.insertOne({
              user_id: userId,
              email: 'test.user.' + Date.now() + '@example.com',
              name: 'Test User',
              picture: 'https://via.placeholder.com/150',
              created_at: new Date()
            });
            db.user_sessions.insertOne({
              user_id: userId,
              session_token: sessionToken,
              expires_at: new Date(Date.now() + 7*24*60*60*1000),
              created_at: new Date()
            });
            print('SESSION_TOKEN:' + sessionToken);
            print('USER_ID:' + userId);
            """
            
            result = subprocess.run(
                ['mongosh', '--eval', script, '--quiet'], 
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                # Extract session token
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if line.startswith('SESSION_TOKEN:'):
                        self.session_token = line.split(':')[1]
                        self.log_result("Test session creation", True, f"Session token: {self.session_token}")
                        return True
                
                self.log_result("Test session creation", False, "Could not extract session token")
            else:
                self.log_result("Test session creation", False, f"MongoDB error: {result.stderr}")
                
        except Exception as e:
            self.log_result("Test session creation", False, f"Exception: {str(e)}")
            
        return False

    def test_auth_api(self):
        """Test Auth API with test session"""
        print(f"\n🔍 Testing Auth API...")
        
        if not self.session_token:
            self.log_result("Auth API - no session", False, "Test session not created")
            return
            
        success, response, status, content = self.run_api_test('GET', '/api/auth/me', 200)
        
        if success:
            has_user_id = 'user_id' in response
            has_email = 'email' in response
            has_name = 'name' in response
            
            if has_user_id and has_email and has_name:
                self.log_result("Auth API", True, f"User data: {response.get('email', 'N/A')}")
            else:
                self.log_result("Auth API", False, f"Missing user fields: user_id={has_user_id}, email={has_email}, name={has_name}")
        else:
            self.log_result("Auth API", False, f"Status: {status}, Content: {content}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("=" * 60)
        print("🚀 VIRTUE FOUNDATION IDP - BACKEND API TESTS")
        print("=" * 60)
        
        # Create test session first for auth-protected endpoints
        self.create_test_session()
        
        # Run all tests
        self.test_health_endpoint()
        self.test_facilities_api()
        self.test_stats_api()
        self.test_medical_deserts_api()
        self.test_chat_rag_api()
        self.test_multi_turn_memory()
        self.test_text2sql_api()
        self.test_mlflow_runs_api()
        self.test_planning_api()
        self.test_auth_api()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        print(f"✅ Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Tests failed: {len(self.failed_tests)}/{self.tests_run}")
        
        if self.failed_tests:
            print("\n🔍 FAILED TESTS:")
            for fail in self.failed_tests:
                print(f"  • {fail['test']}: {fail['details']}")
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"\n📈 Success rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = VirtueFoundationAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)