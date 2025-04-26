import styles from '../css/Monitoring.module.css'
import Logged from '../assets/logged.png'

const Monitoring = () => {
    return(
        <div className={styles.Monitoring}>
            <span className={styles.Monitoring_title}>Employee Monitoring</span>
            <div className={styles.Widget_container}>
                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>Logged In</span>
                        <img src={Logged} alt="User icon" />
                    </div>
                    <span className={styles.Count}>21/50</span>
                </div>

                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>Logged In</span>
                        <img src={Logged} alt="User icon" />
                    </div>
                    <span className={styles.Count}>21/50</span>
                </div>

                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>Logged In</span>
                        <img src={Logged} alt="User icon" />
                    </div>
                    <span className={styles.Count}>21/50</span>
                </div>

                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>Logged In</span>
                        <img src={Logged} alt="User icon" />
                    </div>
                    <span className={styles.Count}>21/50</span>
                </div>
            </div>
        </div>
    )
}


export default Monitoring;