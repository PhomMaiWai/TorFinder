# The secrets vault (ASVS 13.3.1), reachable only on the internal network and
# only over TLS with a certificate from the internal CA (docker/certs/generate.sh).
storage "file" {
  path = "/vault/file"
}

listener "tcp" {
  address         = "0.0.0.0:8200"
  tls_cert_file   = "/certs/vault.crt"
  tls_key_file    = "/certs/vault.key"
  tls_min_version = "tls12"
}

api_addr      = "https://vault:8200"
disable_mlock = true
ui            = false
