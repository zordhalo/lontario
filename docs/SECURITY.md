# Security Model - Lontario AI Hiring Platform

This document describes the Row Level Security (RLS) implementation and data access patterns for the Lontario hiring platform.

## Overview

The platform uses Supabase's Row Level Security (RLS) to enforce data isolation at the database level. This ensures that:

1. **Users can only access data they are authorized to view**
2. **Organizations' data is completely isolated from each other**
3. **Candidates cannot see other candidates' information**
4. **Unauthenticated users can only access public data**

## User Roles

The platform supports four user roles with increasing levels of access:

| Role | Description | Access Level |
|------|-------------|--------------|
| `candidate` | Job applicants | Own data only |
| `recruiter` | Hiring team members | Organization data |
| `hiring_manager` | Team leads | Organization data + interview management |
| `admin` | Platform administrators | Full organization access |

### Role Hierarchy

```
admin
  └── hiring_manager
        └── recruiter
              └── candidate
```

## Access Control Matrix

### Jobs Table

| Operation | Anonymous | Candidate | Recruiter | Hiring Manager | Admin |
|-----------|-----------|-----------|-----------|----------------|-------|
| View Published | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Draft/Paused | ❌ | ❌ | ✅ (own org) | ✅ (own org) | ✅ (own org) |
| Create | ❌ | ❌ | ✅ | ✅ | ✅ |
| Update | ❌ | ❌ | ✅ (own org) | ✅ (own org) | ✅ (own org) |
| Delete | ❌ | ❌ | ❌ | ❌ | ✅ (own org) |

### Candidates Table

| Operation | Candidate | Recruiter | Hiring Manager | Admin |
|-----------|-----------|-----------|----------------|-------|
| View Own Applications | ✅ | - | - | - |
| View Org Candidates | ❌ | ✅ | ✅ | ✅ |
| Apply to Jobs | ✅ | - | - | - |
| Update | ❌ | ✅ (own org) | ✅ (own org) | ✅ (own org) |
| Delete | ❌ | ❌ | ❌ | ✅ (own org) |

### AI Interviews Table

| Operation | Candidate | Recruiter | Hiring Manager | Admin |
|-----------|-----------|-----------|----------------|-------|
| View Own Interviews | ✅ | - | - | - |
| View Org Interviews | ❌ | ✅ | ✅ | ✅ |
| Create | ❌ | ✅ | ✅ | ✅ |
| Update Own | ✅ (answers) | - | - | - |
| Update Org | ❌ | ✅ | ✅ | ✅ |
| Delete | ❌ | ❌ | ❌ | ✅ |

### Interview Questions Table

| Operation | Candidate | Recruiter | Hiring Manager | Admin |
|-----------|-----------|-----------|----------------|-------|
| View Own | ✅ | - | - | - |
| View Org | ❌ | ✅ | ✅ | ✅ |
| Submit Answers | ✅ | - | - | - |
| Update (scoring) | ❌ | ✅ | ✅ | ✅ |
| Delete | ❌ | ❌ | ❌ | ✅ |

### Notifications Table

| Operation | User |
|-----------|------|
| View | ✅ (own only) |
| Update | ✅ (own only) |
| Delete | ✅ (own only) |

## Security Principles

### 1. Deny by Default

When RLS is enabled on a table, **no rows are accessible** until explicit policies grant access. This ensures that new tables are secure by default.

### 2. Least Privilege

Users are granted the minimum access required for their role:
- Candidates can only see their own applications
- Recruiters can manage candidates but not delete them
- Only admins can perform destructive operations

### 3. Organization Isolation

Data is isolated between organizations:
- Recruiters in Organization A cannot see Organization B's data
- Even admins can only access their own organization's data
- Cross-organization access is never allowed through RLS

### 4. Authentication Required

Most operations require authentication. The only exceptions are:
- Viewing published (active) job postings
- Submitting job applications (through the API)

## Helper Functions

The following SECURITY DEFINER functions are used to check permissions:

| Function | Description |
|----------|-------------|
| `get_user_role()` | Returns the current user's role |
| `get_user_organization_id()` | Returns the current user's organization ID |
| `user_owns_job(job_id)` | Checks if user has access to a specific job |
| `user_can_access_candidate(candidate_id)` | Checks if user can access a candidate |
| `user_can_access_interview(interview_id)` | Checks if user can access an interview |
| `is_admin()` | Returns true if user is an admin |
| `is_recruiter_or_above()` | Returns true if user is recruiter+ |
| `is_hiring_manager_or_above()` | Returns true if user is hiring_manager+ |
| `has_any_role(roles[])` | Checks if user has any of the specified roles |

## RLS Policy Naming Convention

Policies follow a consistent naming pattern:

```
[Subject] can [action] [scope] [object]
```

Examples:
- `Anyone can view published jobs`
- `Recruiters can view org candidates`
- `Users can update own notifications`
- `Admins can delete jobs`

## Migration Files

The RLS implementation is split into two migration files:

1. **`20260203_001_enable_rls_all_tables.sql`**
   - Enables RLS on all tables
   - Creates helper functions for permission checks
   - Grants execute permissions

2. **`20260203_002_rls_policies.sql`**
   - Creates all RLS policies for each table
   - Documents access patterns

## Testing RLS Policies

Test scripts are provided in `supabase/tests/rls_tests.sql`. Key test scenarios:

### Positive Tests (should succeed)
- [ ] Anonymous users can view active jobs
- [ ] Candidates can view their own applications
- [ ] Candidates can submit interview answers
- [ ] Recruiters can view all candidates in their org
- [ ] Admins can delete records in their org

### Negative Tests (should fail)
- [ ] Candidates cannot see other candidates' data
- [ ] Candidates cannot see draft jobs
- [ ] Recruiters cannot see other orgs' data
- [ ] Recruiters cannot delete candidates
- [ ] Admins cannot access other orgs' data

## Service Role Access

The Supabase service role bypasses all RLS policies. Use it only for:
- Background jobs (question generation, scoring)
- System notifications
- Data migrations
- Administrative tasks

**Never expose the service role key to the client.**

## Security Considerations

### API Layer

While RLS protects the database, the API layer should also:
- Validate input data
- Sanitize user content
- Rate limit requests
- Log security events

### Sensitive Data

The following data requires extra protection:
- `access_token` in ai_interviews (interview access)
- User emails (PII)
- Resume content (PII)

### Audit Trail

All candidate modifications are logged in `candidate_activity`:
- Stage changes
- Score updates
- Comments added
- This provides an audit trail for compliance

## Updating Policies

When modifying RLS policies:

1. **Test in development first** - Never modify production policies without testing
2. **Use transactions** - Wrap policy changes in BEGIN/COMMIT
3. **Drop before recreate** - Always DROP old policies before creating new ones
4. **Document changes** - Update this document with any access changes

## Troubleshooting

### "permission denied for table X"
- User doesn't have a policy granting access
- Check user's role and organization
- Verify the policy conditions

### Data not visible
- RLS may be filtering results
- Check if user has the required role
- Verify organization_id matches

### Performance issues
- Complex policies can slow queries
- Use indexes on columns used in policies
- Consider caching user roles

## Related Documentation

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Lontario Authentication Guide](./AUTHENTICATION.md) (if exists)
