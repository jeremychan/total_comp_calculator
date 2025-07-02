import React from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { User } from 'firebase/auth';

interface AuthButtonProps {
    user: User | null;
    loading: boolean;
    onSignIn: () => void;
    onSignOut: () => void;
}

const AuthButton: React.FC<AuthButtonProps> = ({ user, loading, onSignIn, onSignOut }) => {
    if (loading) {
        return (
            <Button variant="outline-primary" disabled size="sm">
                <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                />
                Connecting...
            </Button>
        );
    }

    if (user) {
        return (
            <div className="d-flex align-items-center gap-2">
                <small className="text-muted">
                    <i className="bi bi-cloud-check-fill text-success me-1"></i>
                    Synced as {user.displayName || user.email}
                </small>
                <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={onSignOut}
                >
                    Sign Out
                </Button>
            </div>
        );
    }

    return (
        <Button
            variant="primary"
            size="sm"
            onClick={onSignIn}
            className="d-flex align-items-center gap-1"
        >
            <i className="bi bi-google"></i>
            Sign In to Sync
        </Button>
    );
};

export default AuthButton; 