output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.clawdbot.id
}

output "public_ip" {
  description = "EC2 public IP address"
  value       = aws_instance.clawdbot.public_ip
}

output "private_key_path" {
  description = "Path to the private key file"
  value       = local_file.private_key.filename
}
