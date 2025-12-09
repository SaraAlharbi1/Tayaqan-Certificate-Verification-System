"""
Minimal Unit Tests for Accounts App
Tests critical validators, utils, and model methods only.
"""

from django.test import TestCase
from api.accounts.validators import (
    is_email,
    is_national_id_10_digits,
    strong_password,
    is_eth_address,
)
from api.accounts.utils import normalize_national_id, keccak256_hex
from api.accounts.models import User, Institution


class ValidatorsTest(TestCase):
    

    def test_email_validation(self):
        
        assert is_email("user@example.com")
        assert not is_email("invalid-email")

    def test_national_id_validation(self):
        
        assert is_national_id_10_digits("1234567890")
        assert not is_national_id_10_digits("123456789")  

    def test_password_strength(self):
        
        assert strong_password("Password123")
        assert not strong_password("weak") 

    def test_eth_address_validation(self):
       
        assert is_eth_address("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5")
        assert not is_eth_address("0x123") 


class UtilsTest(TestCase):
    

    def test_normalize_national_id(self):
        
        assert normalize_national_id("1234567890") == "1234567890"
        assert normalize_national_id("١٢٣٤٥٦٧٨٩٠") == "1234567890" 
        assert normalize_national_id("  1234567890  ") == "1234567890" 

    def test_keccak256_hashing(self):
        
        hash1 = keccak256_hex("1234567890")
        hash2 = keccak256_hex("1234567890")
        assert hash1 == hash2
        assert hash1.startswith("0x")
        assert len(hash1) == 66  


class ModelTest(TestCase):
    

    def test_institution_id_generation(self):
        
        inst = Institution.objects.create(
            user=User.objects.create_user(email="inst@test.com"),
            institution_name="Test University",
            official_email="info@test.edu",
            wallet_address="0x" + "1" * 40,
        )
        inst_id = inst.generate_institution_id()
        
        assert "-" in inst_id
        base, number = inst_id.split("-")
        assert len(base) == 3
        assert number.isdigit()
